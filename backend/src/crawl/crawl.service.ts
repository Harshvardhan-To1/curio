import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { concat, from, Observable } from 'rxjs';
import { AppConfig } from '../config/configuration';
import { JobEntity } from './entities/job.entity';
import { CreateCrawlDto } from './dto/create-crawl.dto';
import { SsrfService } from '../security/ssrf.service';
import { CrawlerService } from '../crawler/crawler.service';
import { StorageService, StoredChunk } from '../corpus/storage.service';
import { ProgressEvent, ProgressService } from '../events/progress.service';
import { CRAWL_QUEUE, CrawlJobData } from '../queue/queue.constants';

@Injectable()
export class CrawlService {
  private readonly logger = new Logger(CrawlService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(JobEntity) private readonly jobs: Repository<JobEntity>,
    @InjectQueue(CRAWL_QUEUE) private readonly queue: Queue<CrawlJobData>,
    private readonly ssrf: SsrfService,
    private readonly crawler: CrawlerService,
    private readonly storage: StorageService,
    private readonly progress: ProgressService,
  ) {}

  async create(dto: CreateCrawlDto): Promise<{ jobId: string }> {
    // Hard SSRF validation before we accept the job (re-validated per fetch).
    const url = this.ssrf.validateUrl(dto.url);
    const defaults = this.config.get('crawl', { infer: true });

    const job = this.jobs.create({
      seedUrl: url.toString(),
      state: 'pending',
      embedMode: this.config.get('embedMode', { infer: true }),
      options: {
        maxPages: dto.options?.maxPages ?? defaults.maxPages,
        maxDepth: dto.options?.maxDepth ?? defaults.maxDepth,
        sameOriginOnly: dto.options?.sameOriginOnly ?? defaults.sameOriginOnly,
        respectRobots: dto.options?.respectRobots ?? defaults.respectRobots,
        requestsPerSecond:
          dto.options?.requestsPerSecond ?? defaults.requestsPerSecond,
      },
    });
    const saved = await this.jobs.save(job);

    await this.queue.add(
      'crawl',
      { jobId: saved.id },
      {
        jobId: saved.id,
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    this.logger.log(`Enqueued crawl ${saved.id} for ${saved.seedUrl}`);
    return { jobId: saved.id };
  }

  async getJob(jobId: string): Promise<JobEntity> {
    const job = await this.jobs.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException(`No crawl job ${jobId}`);
    return job;
  }

  async getStatus(jobId: string) {
    const job = await this.getJob(jobId);
    return {
      jobId: job.id,
      seedUrl: job.seedUrl,
      state: job.state,
      embedMode: job.embedMode,
      pagesFound: job.pagesFound,
      pagesDone: job.pagesDone,
      chunkCount: job.chunkCount,
      errors: job.errors,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  /** Snapshot first, then live events — so a late SSE subscriber isn't blind. */
  stream(jobId: string): Observable<ProgressEvent> {
    const snapshot$ = from(
      this.getStatus(jobId).then((s): ProgressEvent => ({
        type: 'state',
        jobId: s.jobId,
        state: s.state,
        pagesFound: s.pagesFound,
        pagesDone: s.pagesDone,
        chunkCount: s.chunkCount,
        at: new Date().toISOString(),
      })),
    );
    return concat(snapshot$, this.progress.stream(jobId));
  }

  async getCorpus(jobId: string, offset: number, limit: number) {
    const job = await this.getJob(jobId);
    const includeVectors = job.embedMode === 'fat-server';
    const { total, chunks } = await this.storage.getCorpus(
      jobId,
      offset,
      limit,
      includeVectors,
    );
    return {
      jobId,
      embedMode: job.embedMode,
      embedModel: includeVectors
        ? this.config.get('embedModel', { infer: true })
        : null,
      total,
      offset,
      limit,
      chunks,
    };
  }

  async addPage(
    jobId: string,
    url: string,
  ): Promise<{ added: number; chunks: StoredChunk[] }> {
    await this.getJob(jobId);
    const validated = this.ssrf.validateUrl(url);
    const chunks = await this.crawler.crawlSinglePage(
      jobId,
      validated.toString(),
    );
    return { added: chunks.length, chunks };
  }
}
