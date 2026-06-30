import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);
  const corsOrigins = config.get('corsOrigins', { infer: true });

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`SiteRAG API listening on :${port}`);
}

bootstrap();
