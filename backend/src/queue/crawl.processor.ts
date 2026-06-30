import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { AppConfig } from '../config/configuration';
import { CrawlerService } from '../crawler/crawler.service';
import { CRAWL_QUEUE, CrawlJobData } from './queue.constants';

/**
 * BullMQ worker that runs the crawl pipeline. Registered only in processes
 * whose ROLE is `worker` or `all` (see QueueModule), so the API process can run
 * lean without pulling jobs.
 */
@Processor(CRAWL_QUEUE, {
  concurrency: Number(process.env.CRAWL_WORKER_CONCURRENCY ?? 2),
})
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(
    private readonly crawler: CrawlerService,
    _config: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  async process(job: Job<CrawlJobData>): Promise<void> {
    this.logger.log(`Processing crawl job ${job.data.jobId}`);
    await this.crawler.crawl(job.data.jobId);
  }
}
