import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * API contract tests. Requires Postgres + Redis (provided by docker-compose
 * locally and by service containers in CI). Runs in ROLE=api so no crawl jobs
 * are consumed during the test.
 */
describe('Crawl API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.ROLE = 'api';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/version → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('siterag-backend');
    expect(['thin-server', 'fat-server']).toContain(res.body.embedMode);
  });

  it('POST /api/crawl rejects a missing url (400)', async () => {
    const res = await request(app.getHttpServer()).post('/api/crawl').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/crawl rejects an SSRF metadata URL (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/crawl')
      .send({ url: 'http://169.254.169.254/latest/meta-data' });
    expect(res.status).toBe(400);
  });

  it('POST /api/crawl rejects a loopback URL (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/crawl')
      .send({ url: 'http://127.0.0.1/admin' });
    expect(res.status).toBe(400);
  });

  it('GET status for unknown job → 404', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/crawl/00000000-0000-4000-8000-000000000000/status',
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/crawl accepts a valid public URL and returns a jobId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/crawl')
      .send({
        url: 'https://example.com',
        options: { maxPages: 1, maxDepth: 0 },
      });
    expect(res.status).toBe(201);
    expect(res.body.jobId).toMatch(/[0-9a-f-]{36}/);
  });
});
