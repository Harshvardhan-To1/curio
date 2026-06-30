import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { ChunkEntity } from '../crawl/entities/chunk.entity';
import { CorpusChunk } from '../chunk/chunker.service';

export interface StoredChunk extends CorpusChunk {
  embedding?: number[] | null;
}

/**
 * Owns chunk persistence and corpus reads. When USE_PGVECTOR=true it also
 * maintains a parallel `embedding_vec vector(N)` column + ivfflat index for
 * optional server-side ANN (fat-server). The portable JSON `embedding` column
 * is always written so thin/fat clients work without the extension.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly usePgvector: boolean;
  private readonly embedDim: number;
  private pgvectorReady = false;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly dataSource: DataSource,
    @InjectRepository(ChunkEntity)
    private readonly chunks: Repository<ChunkEntity>,
  ) {
    this.usePgvector = this.config.get('usePgvector', { infer: true });
    this.embedDim = this.config.get('embedDim', { infer: true });
  }

  async onModuleInit() {
    if (!this.usePgvector) return;
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
      await this.dataSource.query(
        `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(${this.embedDim})`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS chunks_embedding_vec_idx
         ON chunks USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 100)`,
      );
      this.pgvectorReady = true;
      this.logger.log(`pgvector ready (dim=${this.embedDim})`);
    } catch (err) {
      this.logger.error(
        `pgvector init failed; falling back to JSON vectors only: ${(err as Error).message}`,
      );
    }
  }

  async saveChunks(jobId: string, chunks: StoredChunk[]): Promise<number> {
    if (!chunks.length) return 0;
    const rows = chunks.map((c) => ({
      jobId,
      chunkId: c.chunkId,
      sourceUrl: c.sourceUrl,
      pageTitle: c.pageTitle,
      headingPath: c.headingPath,
      position: c.position,
      text: c.text,
      tokenEstimate: c.tokenEstimate,
      crawledAt: new Date(c.crawledAt),
      embedding: c.embedding ?? null,
    }));
    const saved = await this.chunks.save(rows, { chunk: 200 });

    if (this.pgvectorReady) {
      for (const row of saved) {
        if (!row.embedding) continue;
        await this.dataSource.query(
          `UPDATE chunks SET embedding_vec = $1 WHERE id = $2`,
          [`[${row.embedding.join(',')}]`, row.id],
        );
      }
    }
    return saved.length;
  }

  /** Paginated corpus read. Vectors are included only in fat-server mode. */
  async getCorpus(
    jobId: string,
    offset: number,
    limit: number,
    includeVectors: boolean,
  ): Promise<{ total: number; chunks: StoredChunk[] }> {
    const [items, total] = await this.chunks.findAndCount({
      where: { jobId },
      order: { position: 'ASC' },
      skip: offset,
      take: limit,
    });
    return {
      total,
      chunks: items.map((c) => ({
        chunkId: c.chunkId,
        sourceUrl: c.sourceUrl,
        pageTitle: c.pageTitle,
        headingPath: c.headingPath,
        position: c.position,
        text: c.text,
        tokenEstimate: c.tokenEstimate,
        crawledAt: c.crawledAt.toISOString(),
        ...(includeVectors ? { embedding: c.embedding } : {}),
      })),
    };
  }

  /** Optional server-side ANN (fat-server + pgvector). */
  async nearest(
    jobId: string,
    queryVec: number[],
    k: number,
  ): Promise<StoredChunk[]> {
    if (!this.pgvectorReady) {
      throw new Error('pgvector is not enabled; cannot run server-side search');
    }
    const literal = `[${queryVec.join(',')}]`;
    const rows = await this.dataSource.query(
      `SELECT "chunkId", "sourceUrl", "pageTitle", "headingPath", position, text,
              "tokenEstimate", "crawledAt"
       FROM chunks
       WHERE "jobId" = $1 AND embedding_vec IS NOT NULL
       ORDER BY embedding_vec <=> $2
       LIMIT $3`,
      [jobId, literal, k],
    );
    return rows.map((r: Record<string, unknown>) => ({
      ...r,
      crawledAt: (r.crawledAt as Date).toISOString(),
    })) as StoredChunk[];
  }
}
