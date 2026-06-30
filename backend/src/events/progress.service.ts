import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Observable } from 'rxjs';
import { AppConfig } from '../config/configuration';

export interface ProgressEvent {
  type: 'state' | 'page' | 'error' | 'done';
  jobId: string;
  state?: string;
  pagesFound?: number;
  pagesDone?: number;
  chunkCount?: number;
  url?: string;
  message?: string;
  at: string;
}

/**
 * Cross-process crawl progress via Redis pub/sub. The worker publishes; the API
 * process streams to the browser over SSE. A dedicated subscriber connection is
 * created per stream and torn down on unsubscribe.
 */
@Injectable()
export class ProgressService implements OnModuleDestroy {
  private readonly logger = new Logger(ProgressService.name);
  private readonly publisher: Redis;
  private readonly redisUrl: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.redisUrl = config.get('redisUrl', { infer: true });
    this.publisher = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
  }

  private channel(jobId: string): string {
    return `crawl:progress:${jobId}`;
  }

  async publish(event: ProgressEvent): Promise<void> {
    await this.publisher.publish(
      this.channel(event.jobId),
      JSON.stringify(event),
    );
  }

  /** Observable of progress events for a job; manages its own subscriber conn. */
  stream(jobId: string): Observable<ProgressEvent> {
    return new Observable<ProgressEvent>((subscriber) => {
      const sub = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
      const channel = this.channel(jobId);
      sub.subscribe(channel).catch((err) => subscriber.error(err));
      sub.on('message', (_chan, payload) => {
        try {
          const event = JSON.parse(payload) as ProgressEvent;
          subscriber.next(event);
          if (event.type === 'done') subscriber.complete();
        } catch (err) {
          this.logger.warn(`Bad progress payload: ${(err as Error).message}`);
        }
      });
      return () => {
        sub.removeAllListeners();
        sub.quit().catch(() => undefined);
      };
    });
  }

  async onModuleDestroy() {
    await this.publisher.quit().catch(() => undefined);
  }
}
