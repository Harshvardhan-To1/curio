/**
 * Central typed configuration, parsed once from environment variables.
 * Every other module reads from here via ConfigService<AppConfig>.
 */

export type EmbedMode = 'thin-server' | 'fat-server';
export type Role = 'api' | 'worker' | 'all';

export interface CrawlDefaults {
  userAgent: string;
  maxPages: number;
  maxDepth: number;
  requestsPerSecond: number;
  perPageTimeoutMs: number;
  timeBudgetMs: number;
  maxContentBytes: number;
  sameOriginOnly: boolean;
  respectRobots: boolean;
  workerConcurrency: number;
}

export interface AppConfig {
  nodeEnv: string;
  role: Role;
  port: number;
  logLevel: string;
  logPretty: boolean;
  corsOrigins: string[];
  databaseUrl: string;
  dbSynchronize: boolean;
  redisUrl: string;
  embedMode: EmbedMode;
  embedModel: string;
  embedDim: number;
  usePgvector: boolean;
  crawl: CrawlDefaults;
  chunkTargetTokens: number;
  chunkOverlapTokens: number;
  ssrfAllowPrivate: boolean;
  rateLimitTtlSeconds: number;
  rateLimitMax: number;
  sentryDsn: string;
}

const bool = (v: string | undefined, dflt = false): boolean =>
  v === undefined ? dflt : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : dflt;
};

const list = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  role: (process.env.ROLE as Role) ?? 'all',
  port: num(process.env.PORT, 8000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logPretty: bool(process.env.LOG_PRETTY, false),
  corsOrigins: list(process.env.CORS_ORIGINS),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://siterag:siterag@localhost:5432/siterag',
  dbSynchronize: bool(process.env.DB_SYNCHRONIZE, false),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  embedMode: (process.env.EMBED_MODE as EmbedMode) ?? 'thin-server',
  embedModel: process.env.EMBED_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
  embedDim: num(process.env.EMBED_DIM, 384),
  usePgvector: bool(process.env.USE_PGVECTOR, false),
  crawl: {
    userAgent:
      process.env.CRAWL_USER_AGENT ??
      'SiteRAGBot/0.1 (+https://siterag.app/bot)',
    maxPages: num(process.env.CRAWL_MAX_PAGES, 100),
    maxDepth: num(process.env.CRAWL_MAX_DEPTH, 3),
    requestsPerSecond: num(process.env.CRAWL_REQUESTS_PER_SECOND, 2),
    perPageTimeoutMs: num(process.env.CRAWL_PER_PAGE_TIMEOUT_MS, 15000),
    timeBudgetMs: num(process.env.CRAWL_TIME_BUDGET_MS, 180000),
    maxContentBytes: num(process.env.CRAWL_MAX_CONTENT_BYTES, 5_000_000),
    sameOriginOnly: bool(process.env.CRAWL_SAME_ORIGIN_ONLY, true),
    respectRobots: bool(process.env.CRAWL_RESPECT_ROBOTS, true),
    workerConcurrency: num(process.env.CRAWL_WORKER_CONCURRENCY, 2),
  },
  chunkTargetTokens: num(process.env.CHUNK_TARGET_TOKENS, 512),
  chunkOverlapTokens: num(process.env.CHUNK_OVERLAP_TOKENS, 50),
  ssrfAllowPrivate: bool(process.env.SSRF_ALLOW_PRIVATE, false),
  rateLimitTtlSeconds: num(process.env.RATE_LIMIT_TTL_SECONDS, 60),
  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 30),
  sentryDsn: process.env.SENTRY_DSN ?? '',
});
