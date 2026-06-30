# SiteRAG - Backend (crawl → corpus)

The server side of SiteRAG: a robots-aware, SSRF-guarded crawler that turns a
website into a clean, chunked RAG corpus the browser can embed and chat with.
This is the **backend-only** deliverable (milestones M1 + the server pieces of
M5). The browser app (WebLLM generation, Transformers.js embeddings, Voy vector
search, the LangChain.js agent loop) is a separate deliverable.

> **Stack:** NestJS 10 + TypeScript · Cheerio + Readability + Turndown ·
> BullMQ (Redis) · Postgres (TypeORM, optional pgvector) · undici (DNS-pinned).

## Architecture

```
POST /api/crawl ──► BullMQ queue ──► worker
                                       │
   Crawler (BFS, robots, rps throttle, SSRF-guarded undici)
        │ sitemap.xml discovery → breadth-first link following
        ▼
   Extractor (jsdom + Readability → Turndown markdown, scripts stripped)
        ▼
   Chunker (heading-aware recursive split, ~512 tok / 50 overlap, stable ids)
        ▼
   [fat-server only] Embedder (Transformers.js, same model id as browser)
        ▼
   Postgres (jobs · pages · chunks [+ pgvector])   Redis pub/sub → SSE progress
```

**Why a custom crawler instead of Crawlee?** The SSRF requirement (re-resolve
DNS and re-validate the resolved IP *before every request*, re-validate every
redirect hop) needs request-level connection control. We keep **Cheerio** for
HTML parsing but drive fetching through an **undici dispatcher with a DNS-pinning
lookup** (`src/security/ssrf.service.ts`) so a socket can only ever reach an IP
we approved - closing the DNS-rebinding window that high-level crawlers leave open.

### Embedding modes (`EMBED_MODE`)

| Mode | Server does | Browser does | When |
|------|-------------|--------------|------|
| `thin-server` *(default)* | ships cleaned chunks only | embeds + searches | max privacy, sites ≲5k chunks |
| `fat-server` | precomputes embeddings (`EMBED_MODEL`) | searches | large sites, faster first answer |

> In `fat-server` mode the server and browser **must** use the same embedding
> model id (`Xenova/all-MiniLM-L6-v2`, 384-dim) or retrieval silently breaks.
> Install the optional embedding deps: `npm ci` (includes optionalDependencies)
> or build the image with `--build-arg INSTALL_EMBEDDINGS=true`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/crawl` | `{ url, options? }` → `{ jobId }` (hard SSRF validation) |
| `GET`  | `/api/crawl/:jobId/status` | job state + counters + errors |
| `GET`  | `/api/crawl/:jobId/stream` | **SSE** live progress |
| `GET`  | `/api/crawl/:jobId/corpus?offset&limit` | paginated chunks (+vectors in fat mode) |
| `POST` | `/api/crawl/:jobId/page` | `{ url }` → crawl one extra page on demand (agent `fetch_more`) |
| `GET`  | `/api/health` · `/api/version` | health probe · build/mode info |

`options`: `maxPages` (≤2000), `maxDepth` (≤10), `sameOriginOnly`,
`respectRobots`, `requestsPerSecond`.

## Quick start

```bash
cp backend/.env.example backend/.env     # review the values
make dev                                 # postgres + redis + api + worker
# in another shell, once healthy:
make seed                                # end-to-end crawl smoke test
```

Local dev without Docker:

```bash
cd backend && npm ci
# point DATABASE_URL / REDIS_URL at local services, then:
npm run start:dev      # ROLE=all → API + worker in one process
```

## Process roles (`ROLE`)

- `api` - HTTP only (no queue consumer).
- `worker` - BullMQ consumer only (`dist/worker.js`, no HTTP).
- `all` - both, for single-process local dev (default).

docker-compose runs `api` and `worker` as separate services per the spec.

## Security (spec §7)

- **SSRF:** scheme + port allowlist, rejects credentials-in-URL, blocks
  private/loopback/link-local/CGNAT/reserved ranges **and** the cloud metadata
  IP `169.254.169.254`, DNS-pinned connections, per-hop redirect re-validation,
  response-size cap. Never set `SSRF_ALLOW_PRIVATE=true` in production.
- **robots.txt** respected (allow rules, crawl-delay, sitemaps); clear bot UA.
- **Rate limiting** per IP via `@nestjs/throttler` (`RATE_LIMIT_*`).
- **XSS:** scripts/styles/iframes stripped at extraction; output is Markdown.
- **CORS** locked to `CORS_ORIGINS`; `helmet` headers.

## Tests

```bash
make test          # unit (jest) + coverage gate (70%)
npm run test:e2e   # API contract tests (needs postgres + redis)
```

Unit: SSRF classifier, URL normalization, chunker, extractor. E2E: API contract
incl. SSRF rejections. CI (`.github/workflows/ci.yml`) runs lint → typecheck →
unit → build → e2e with Postgres/Redis service containers, then builds the image.

## Configuration

Every variable is documented in [`.env.example`](./.env.example). Key ones:
`EMBED_MODE`, `EMBED_MODEL`, `USE_PGVECTOR`, `CRAWL_MAX_PAGES`, `CRAWL_MAX_DEPTH`,
`CRAWL_REQUESTS_PER_SECOND`, `CRAWL_RESPECT_ROBOTS`, `SSRF_ALLOW_PRIVATE`,
`RATE_LIMIT_MAX`.

## Deployment

Build once, run two services from the same image (`node dist/main.js` and
`node dist/worker.js`) with managed Redis + Postgres. For `fat-server`, build
with `INSTALL_EMBEDDINGS=true` and set `USE_PGVECTOR=true` (the app creates the
`vector` extension, column, and ivfflat index on boot).
