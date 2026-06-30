import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { AppConfig } from '../config/configuration';
import { JobEntity, JobError } from '../crawl/entities/job.entity';
import { PageEntity } from '../crawl/entities/page.entity';
import { SsrfService } from '../security/ssrf.service';
import { RobotsService } from './robots.service';
import { ExtractorService } from '../extract/extractor.service';
import { ChunkerService } from '../chunk/chunker.service';
import { EmbedderService } from '../embed/embedder.service';
import { StorageService, StoredChunk } from '../corpus/storage.service';
import { ProgressService } from '../events/progress.service';
import {
  isCrawlableUrl,
  normalizeUrl,
  sameOrigin,
  sameSite,
} from './url-utils';

interface FrontierItem {
  url: string;
  depth: number;
}

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

/**
 * Robots-aware, SSRF-guarded, polite BFS crawler. Runs sequentially (one
 * in-flight request) so the rate limit and crawl-delay are naturally honored.
 * One bad page is recorded and skipped — it never fails the whole job.
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(JobEntity) private readonly jobs: Repository<JobEntity>,
    @InjectRepository(PageEntity)
    private readonly pages: Repository<PageEntity>,
    private readonly ssrf: SsrfService,
    private readonly robots: RobotsService,
    private readonly extractor: ExtractorService,
    private readonly chunker: ChunkerService,
    private readonly embedder: EmbedderService,
    private readonly storage: StorageService,
    private readonly progress: ProgressService,
  ) {}

  async crawl(jobId: string): Promise<void> {
    const job = await this.jobs.findOneByOrFail({ id: jobId });
    const ua = this.config.get('crawl', { infer: true }).userAgent;
    const perPageTimeout = this.config.get('crawl', {
      infer: true,
    }).perPageTimeoutMs;
    const timeBudget = this.config.get('crawl', { infer: true }).timeBudgetMs;
    const maxBytes = this.config.get('crawl', { infer: true }).maxContentBytes;
    const deadline = Date.now() + timeBudget;
    const delayMs = Math.ceil(
      1000 / Math.max(1, job.options.requestsPerSecond),
    );

    job.state = 'running';
    job.startedAt = new Date();
    await this.jobs.save(job);
    await this.emit(job, 'state');

    if (job.options.respectRobots) {
      await this.robots.load(job.seedUrl, ua, perPageTimeout);
    }
    const robotsDelay = job.options.respectRobots
      ? (this.robots.crawlDelaySeconds(job.seedUrl, ua) ?? 0) * 1000
      : 0;
    const effectiveDelay = Math.max(delayMs, robotsDelay);

    const visited = new Set<string>();
    const seenHashes = new Set<string>();
    const frontier: FrontierItem[] = [];
    const seed = normalizeUrl(job.seedUrl);
    if (seed) {
      frontier.push({ url: seed, depth: 0 });
      visited.add(seed);
    }
    await this.seedFromSitemaps(job, ua, perPageTimeout, frontier, visited);

    job.pagesFound = frontier.length;
    await this.jobs.save(job);

    try {
      while (frontier.length && job.pagesDone < job.options.maxPages) {
        if (Date.now() > deadline) {
          this.logger.warn(`Job ${jobId} hit time budget; stopping crawl.`);
          break;
        }
        const item = frontier.shift()!;
        await this.processOne(job, item, {
          ua,
          perPageTimeout,
          maxBytes,
          seenHashes,
          visited,
          frontier,
        });
        if (effectiveDelay > 0 && frontier.length) {
          await this.sleep(effectiveDelay);
        }
      }

      job.state = 'completed';
      job.finishedAt = new Date();
      await this.jobs.save(job);
      await this.emit(job, 'done');
      this.logger.log(
        `Job ${jobId} done: ${job.pagesDone} pages, ${job.chunkCount} chunks.`,
      );
    } catch (err) {
      job.state = 'failed';
      job.finishedAt = new Date();
      this.pushError(job, job.seedUrl, (err as Error).message);
      await this.jobs.save(job);
      await this.emit(job, 'done');
      throw err;
    }
  }

  /** Fetch one extra page on demand (agent fetch_more tool). Returns chunks. */
  async crawlSinglePage(jobId: string, url: string): Promise<StoredChunk[]> {
    const job = await this.jobs.findOneByOrFail({ id: jobId });
    const ua = this.config.get('crawl', { infer: true }).userAgent;
    const perPageTimeout = this.config.get('crawl', {
      infer: true,
    }).perPageTimeoutMs;
    const maxBytes = this.config.get('crawl', { infer: true }).maxContentBytes;

    const normalized = normalizeUrl(url);
    if (!normalized) throw new Error(`Unfetchable URL: ${url}`);
    if (job.options.sameOriginOnly && !sameOrigin(job.seedUrl, normalized)) {
      throw new Error('URL is outside the crawl origin');
    }
    if (job.options.respectRobots) {
      await this.robots.load(normalized, ua, perPageTimeout);
      if (!this.robots.isAllowed(normalized, ua)) {
        throw new Error('Blocked by robots.txt');
      }
    }
    const chunks = await this.fetchExtractChunk(job, normalized, 0, {
      ua,
      perPageTimeout,
      maxBytes,
      seenHashes: new Set(),
    });
    if (chunks.length) {
      job.chunkCount += await this.storage.saveChunks(job.id, chunks);
      job.pagesDone += 1;
      await this.jobs.save(job);
    }
    return chunks;
  }

  private async processOne(
    job: JobEntity,
    item: FrontierItem,
    ctx: {
      ua: string;
      perPageTimeout: number;
      maxBytes: number;
      seenHashes: Set<string>;
      visited: Set<string>;
      frontier: FrontierItem[];
    },
  ): Promise<void> {
    try {
      if (
        job.options.respectRobots &&
        !this.robots.isAllowed(item.url, ctx.ua)
      ) {
        await this.recordPage(job, item, 'skipped', null, 0, '');
        return;
      }
      const result = await this.fetchExtractChunk(
        job,
        item.url,
        item.depth,
        ctx,
        {
          onLinks: (links) =>
            this.expandFrontier(job, item, links, ctx.visited, ctx.frontier),
          onPage: (title, hash, mdLen, status) =>
            this.recordPage(job, item, status, hash, mdLen, title),
        },
      );

      if (result.length) {
        job.chunkCount += await this.storage.saveChunks(job.id, result);
      }
      job.pagesDone += 1;
      await this.jobs.save(job);
      await this.emit(job, 'page', item.url);
    } catch (err) {
      this.pushError(job, item.url, (err as Error).message);
      await this.recordPage(job, item, 'error', null, 0, '');
      job.pagesDone += 1;
      await this.jobs.save(job);
      await this.emit(job, 'error', item.url, (err as Error).message);
    }
  }

  private async fetchExtractChunk(
    job: JobEntity,
    url: string,
    depth: number,
    ctx: {
      ua: string;
      perPageTimeout: number;
      maxBytes: number;
      seenHashes: Set<string>;
    },
    hooks?: {
      onLinks?: (links: string[]) => void;
      onPage?: (
        title: string,
        hash: string | null,
        mdLen: number,
        status: 'ok' | 'skipped',
      ) => Promise<void>;
    },
  ): Promise<StoredChunk[]> {
    const res = await this.ssrf.safeFetch(url, {
      userAgent: ctx.ua,
      timeoutMs: ctx.perPageTimeout,
      maxBytes: ctx.maxBytes,
    });

    const isHtml = HTML_TYPES.some((t) => res.contentType.includes(t));
    if (res.status >= 400 || !isHtml) {
      await hooks?.onPage?.('', null, 0, 'skipped');
      return [];
    }

    const hash = createHash('sha256')
      .update(res.body)
      .digest('hex')
      .slice(0, 32);
    if (ctx.seenHashes.has(hash)) {
      await hooks?.onPage?.('', hash, 0, 'skipped'); // duplicate content
      return [];
    }
    ctx.seenHashes.add(hash);

    const extracted = this.extractor.extract(res.body, res.finalUrl);
    if (hooks?.onLinks && extracted) hooks.onLinks(extracted.links);
    if (!extracted) {
      await hooks?.onPage?.('', hash, 0, 'skipped');
      return [];
    }

    const crawledAt = new Date().toISOString();
    const chunks: StoredChunk[] = this.chunker.chunk({
      sourceUrl: res.finalUrl,
      pageTitle: extracted.title,
      markdown: extracted.markdown,
      crawledAt,
    });

    if (this.embedder.isEnabled() && chunks.length) {
      const vectors = await this.embedder.embed(chunks.map((c) => c.text));
      chunks.forEach((c, i) => (c.embedding = vectors[i]));
    }

    await hooks?.onPage?.(
      extracted.title,
      hash,
      extracted.markdown.length,
      'ok',
    );
    return chunks;
  }

  private expandFrontier(
    job: JobEntity,
    parent: FrontierItem,
    links: string[],
    visited: Set<string>,
    frontier: FrontierItem[],
  ): void {
    if (parent.depth >= job.options.maxDepth) return;
    for (const raw of links) {
      const norm = normalizeUrl(raw);
      if (!norm || visited.has(norm)) continue;
      if (!isCrawlableUrl(norm)) continue;
      const inScope = job.options.sameOriginOnly
        ? sameOrigin(job.seedUrl, norm)
        : sameSite(job.seedUrl, norm);
      if (!inScope) continue;
      if (visited.size >= job.options.maxPages * 4) break; // frontier cap
      visited.add(norm);
      frontier.push({ url: norm, depth: parent.depth + 1 });
    }
    job.pagesFound = visited.size;
  }

  private async seedFromSitemaps(
    job: JobEntity,
    ua: string,
    timeoutMs: number,
    frontier: FrontierItem[],
    visited: Set<string>,
  ): Promise<void> {
    const candidates = new Set<string>();
    if (job.options.respectRobots) {
      for (const sm of this.robots.sitemaps(job.seedUrl)) candidates.add(sm);
    }
    try {
      candidates.add(new URL('/sitemap.xml', job.seedUrl).toString());
    } catch {
      /* ignore */
    }

    for (const sm of candidates) {
      try {
        const res = await this.ssrf.safeFetch(sm, {
          userAgent: ua,
          timeoutMs,
          maxBytes: 5 * 1024 * 1024,
        });
        if (res.status >= 400) continue;
        const $ = cheerio.load(res.body, { xmlMode: true });
        $('loc').each((_, el) => {
          const loc = $(el).text().trim();
          const norm = normalizeUrl(loc);
          if (!norm || visited.has(norm) || !isCrawlableUrl(norm)) return;
          const inScope = job.options.sameOriginOnly
            ? sameOrigin(job.seedUrl, norm)
            : sameSite(job.seedUrl, norm);
          if (!inScope) return;
          visited.add(norm);
          frontier.push({ url: norm, depth: 0 });
        });
      } catch (err) {
        this.logger.debug(`Sitemap ${sm} skipped: ${(err as Error).message}`);
      }
    }
  }

  private async recordPage(
    job: JobEntity,
    item: FrontierItem,
    status: PageEntity['status'],
    contentHash: string | null,
    markdownLength: number,
    title: string,
  ): Promise<void> {
    await this.pages
      .upsert(
        {
          jobId: job.id,
          url: item.url,
          title,
          status,
          depth: item.depth,
          contentHash,
          markdownLength,
        },
        ['jobId', 'url'],
      )
      .catch((err) =>
        this.logger.debug(`page upsert failed: ${(err as Error).message}`),
      );
  }

  private pushError(job: JobEntity, url: string, message: string): void {
    const err: JobError = { url, message, at: new Date().toISOString() };
    job.errors = [...(job.errors ?? []), err].slice(-100);
  }

  private async emit(
    job: JobEntity,
    type: 'state' | 'page' | 'error' | 'done',
    url?: string,
    message?: string,
  ): Promise<void> {
    await this.progress
      .publish({
        type,
        jobId: job.id,
        state: job.state,
        pagesFound: job.pagesFound,
        pagesDone: job.pagesDone,
        chunkCount: job.chunkCount,
        url,
        message,
        at: new Date().toISOString(),
      })
      .catch(() => undefined);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
