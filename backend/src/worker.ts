import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * Dedicated crawl-worker process (no HTTP server). docker-compose runs this as
 * the `worker` service with ROLE=worker so the API stays lean. Graceful
 * shutdown lets in-flight BullMQ jobs finish before exit.
 */
async function bootstrap() {
  if (!process.env.ROLE) process.env.ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app
    .get(Logger)
    .log(`SiteRAG crawl worker started (ROLE=${process.env.ROLE})`);
}

bootstrap();
