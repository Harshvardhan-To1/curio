# Deploying Curio for free

Curio is a hybrid app, so it deploys as **two pieces**:

| Piece | What it does | Free host |
|-------|--------------|-----------|
| **Frontend** (`frontend/`) | Next.js app — runs the in-browser LLM, embeddings, RAG, chat UI | **Vercel** |
| **Backend** (`backend/`) | Crawler + corpus API + queue worker | **Render** (web service + Postgres + Key Value) |

The language model and your questions stay in the browser; the backend only crawls
public pages and serves cleaned text. That split is what makes a free deploy realistic.

```
 Browser ──HTTPS──►  Vercel (Next.js, WebGPU)  ──REST/SSE──►  Render (NestJS API+worker)
                                                                 ├─ Render Postgres
                                                                 └─ Render Key Value (Redis)
```

> **Total cost: $0.** Caveats: Render's free web service **sleeps after ~15 min idle**
> (first request after waking takes ~30–60s), and its free Postgres is deleted after
> ~30 days. Both are fine for a demo/portfolio. Durability upgrades are noted at the end.

---

## 0. Prerequisites

1. Push this repo to **GitHub** (Render and Vercel deploy from a Git repo).
   ```bash
   git init && git add . && git commit -m "Curio"
   git remote add origin https://github.com/<you>/curio.git
   git push -u origin main
   ```
2. Free accounts on **[Vercel](https://vercel.com)** and **[Render](https://render.com)**
   (sign in with GitHub for both).

---

## 1. Backend → Render (one click, via Blueprint)

The repo ships a [`render.yaml`](./render.yaml) Blueprint that provisions everything:
the API+worker web service, Postgres, and Redis (Key Value).

1. Render dashboard → **New +** → **Blueprint**.
2. Pick your `curio` repo → Render reads `render.yaml` → **Apply**.
3. It creates three resources: `curio-api`, `curio-db`, `curio-redis`.
   `DATABASE_URL` and `REDIS_URL` are wired automatically.
4. Wait for `curio-api` to go **Live**, then copy its URL, e.g.
   `https://curio-api.onrender.com`. Check `https://curio-api.onrender.com/api/health`.

> One env var is intentionally left blank: **`CORS_ORIGINS`**. You'll set it to your
> Vercel URL in step 3 (you don't have it yet).

**Why one service runs both API and worker:** `ROLE=all` makes the single free web
service host the HTTP API *and* the in-process BullMQ worker — so you don't need a
(paid) separate background worker. A crawl finishes in a minute or two, well inside
the idle window.

---

## 2. Frontend → Vercel

1. Vercel dashboard → **Add New… → Project** → import your `curio` repo.
2. **Root Directory: `frontend`** (important — the repo has two apps).
   Framework preset **Next.js** is detected automatically.
3. Add **Environment Variables**:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | your Render URL, e.g. `https://curio-api.onrender.com` |
   | `NEXT_PUBLIC_DEFAULT_MODEL` | `Llama-3.2-1B-Instruct-q4f16_1-MLC` |
   | `NEXT_PUBLIC_EMBED_MODEL` | `Xenova/all-MiniLM-L6-v2` |
4. **Deploy.** Copy the resulting URL, e.g. `https://curio.vercel.app`.

The required cross-origin isolation headers (`COOP`/`COEP`) are already declared in
`frontend/next.config.mjs`, and Vercel applies them — no extra config needed.

---

## 3. Connect the two (CORS)

1. Back in Render → `curio-api` → **Environment** → set
   **`CORS_ORIGINS`** = your Vercel URL (no trailing slash), e.g.
   `https://curio.vercel.app`. Save → it redeploys.
2. Open your Vercel URL in **Chrome/Edge**, paste a website URL, and chat. 🎉

> Add multiple origins comma-separated if you have a preview + prod domain:
> `https://curio.vercel.app,https://curio-git-main-you.vercel.app`.

---

## 4. Verify

- `GET https://curio-api.onrender.com/api/health` → `{"status":"ok"}`
- In the app: paste `https://example.com`, watch the crawl → embed → model-load →
  chat flow. The first crawl after the service has been idle is slow (cold start).
- DevTools → Network: while chatting, **no request leaves for generation** — only the
  initial crawl/corpus calls hit Render. That's the privacy guarantee, live.

---

## Environment variables (reference)

**Backend** (`render.yaml` sets these; override in the Render dashboard):

| Var | Prod value | Notes |
|-----|------------|-------|
| `ROLE` | `all` | API + worker in one free service |
| `EMBED_MODE` | `thin-server` | browser embeds; no server cost |
| `DB_SYNCHRONIZE` | `true` | auto-creates tables (demo). Use migrations for real prod |
| `SSRF_ALLOW_PRIVATE` | `false` | **never** `true` in prod |
| `CORS_ORIGINS` | your Vercel URL | lock the API to your frontend |
| `CRAWL_MAX_PAGES` | `60` | keep memory modest on 512 MB free RAM |
| `DATABASE_URL` / `REDIS_URL` | auto-wired | from Render Postgres / Key Value |

**Frontend** (Vercel):

| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | Render backend URL |
| `NEXT_PUBLIC_DEFAULT_MODEL` | default WebLLM model id |
| `NEXT_PUBLIC_EMBED_MODEL` | embedding model (match backend in fat-server mode) |

---

## Alternatives & durability upgrades (still free)

- **Frontend:** Cloudflare Pages works too — set the same COOP/COEP headers in a
  `_headers` file and the env vars above.
- **Postgres durability:** Render's free Postgres expires after ~30 days. Swap in a
  permanent free **[Neon](https://neon.tech)** database: create one, copy its
  connection string into the `curio-api` `DATABASE_URL` env (remove the
  `fromDatabase` wiring), and drop `curio-db` from `render.yaml`.
- **Redis:** **[Upstash](https://upstash.com)** has a free serverless Redis. It speaks
  `rediss://` (TLS) — the backend already handles that. Watch the free command quota
  if you run many crawls.
- **Avoid cold starts:** a free uptime pinger (e.g. cron-job.org hitting `/api/health`
  every 10 min) keeps the Render service warm during demos.

---

## Going beyond the free tier

- Upgrade `curio-api` to a paid Render instance (always-on, more RAM) and split the
  worker into its own service (`node dist/worker.js`, `ROLE=worker`) for throughput.
- Switch to **`fat-server`** mode + enable `USE_PGVECTOR` for large sites — build the
  backend image with `--build-arg INSTALL_EMBEDDINGS=true` so the server-side embedder
  is included (heavier image, needs the same model id as the browser).
- Replace `DB_SYNCHRONIZE=true` with real TypeORM migrations.
