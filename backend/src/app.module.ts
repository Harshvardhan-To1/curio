import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import configuration, { AppConfig, Role } from './config/configuration';

import { JobEntity } from './crawl/entities/job.entity';
import { PageEntity } from './crawl/entities/page.entity';
import { ChunkEntity } from './crawl/entities/chunk.entity';

import { SsrfService } from './security/ssrf.service';
import { RobotsService } from './crawler/robots.service';
import { ExtractorService } from './extract/extractor.service';
import { ChunkerService } from './chunk/chunker.service';
import { EmbedderService } from './embed/embedder.service';
import { StorageService } from './corpus/storage.service';
import { ProgressService } from './events/progress.service';
import { CrawlerService } from './crawler/crawler.service';
import { CrawlService } from './crawl/crawl.service';
import { CrawlController } from './crawl/crawl.controller';
import { HealthController } from './health/health.controller';
import { CrawlProcessor } from './queue/crawl.processor';
import { CRAWL_QUEUE } from './queue/queue.constants';

const ENTITIES = [JobEntity, PageEntity, ChunkEntity];

/** The crawl worker is only registered in `worker`/`all` processes. */
function workerProviders(): Provider[] {
  const role = (process.env.ROLE as Role) ?? 'all';
  return role === 'worker' || role === 'all' ? [CrawlProcessor] : [];
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        pinoHttp: {
          level: config.get('logLevel', { infer: true }),
          transport: config.get('logPretty', { infer: true })
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
          autoLogging: { ignore: (req) => req.url === '/api/health' },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        url: config.get('databaseUrl', { infer: true }),
        entities: ENTITIES,
        synchronize: config.get('dbSynchronize', { infer: true }),
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const url = new URL(config.get('redisUrl', { infer: true }));
        // Managed Redis (Render Key Value, Upstash, etc.) uses TLS via rediss://
        const isTls = url.protocol === 'rediss:';
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            maxRetriesPerRequest: null,
            ...(isTls ? { tls: { servername: url.hostname } } : {}),
          },
        };
      },
    }),
    BullModule.registerQueue({ name: CRAWL_QUEUE }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            ttl: config.get('rateLimitTtlSeconds', { infer: true }) * 1000,
            limit: config.get('rateLimitMax', { infer: true }),
          },
        ],
      }),
    }),
    TerminusModule,
  ],
  controllers: [CrawlController, HealthController],
  providers: [
    SsrfService,
    RobotsService,
    ExtractorService,
    ChunkerService,
    EmbedderService,
    StorageService,
    ProgressService,
    CrawlerService,
    CrawlService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ...workerProviders(),
  ],
})
export class AppModule {}
