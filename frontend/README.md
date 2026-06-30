# SiteRAG — Frontend (in-browser RAG + chat)

The browser app: paste a URL → the backend crawls it → the browser embeds the
corpus, retrieves with an **agentic loop**, and **generates answers entirely
on-device** via WebLLM (WebGPU). Nothing you ask leaves your machine.

> **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind · WebLLM
> (`@mlc-ai/web-llm`) · Transformers.js embeddings · Voy (WASM HNSW) + IndexedDB
> · a constrained ReAct agent.

## How it works (data flow)

```
URL ─► backend /api/crawl (SSE progress) ─► /corpus (cleaned chunks)
                                              │
   ┌──────────────────────── browser ────────┴───────────────────────┐
   │ embed worker (Transformers.js, WebGPU/WASM) ─► vectors           │
   │ Voy HNSW index + IndexedDB cache (keyed by jobId)                │
   │ agent (ReAct JSON loop): retrieve / keyword / list / get / fetch │
   │ llm worker (WebLLM, WebGPU) ─► streamed, cited answer            │
   └──────────────────────────────────────────────────────────────────┘
```

Phases: **capability gate → URL form → crawl progress (SSE) → in-browser
embedding → model download → chat**. Sessions persist in IndexedDB, so a
returning user reloads a previously indexed site offline (model is cached too).

## The agent (spec §4.4)

Small (1–3B) models are weak at free-form tool calling, so the agent is a
**constrained ReAct loop driven by JSON-mode output**, not open function calling:

- Tools: `retrieve`, `keyword_search`, `list_pages`, `get_page`, `fetch_more`.
- Hard cap of **4 iterations**, then it’s forced to answer.
- **Graceful fallback:** two bad JSON replies (or any engine error) → plain
  single-shot RAG (retrieve → stuff → answer). It never hangs.
- Every answer cites the `sourceUrl`s it used, rendered as clickable links.
- A collapsible tool-use trace is shown per answer.

> Implementation note: the spec lists LangChain.js. Its in-browser local-model
> adapters are immature and heavy, and the spec itself mandates a *constrained*
> JSON loop — so the agent is implemented directly against WebLLM’s
> OpenAI-compatible API (`lib/rag/agent.ts`). Same behavior, far less fragility.

## Degraded mode

No WebGPU (or no cross-origin isolation)? The app doesn’t dead-end: it still
crawls, embeds, and shows the **most relevant passages with citations** —
clearly labeled “retrieval-only”. Use Chrome/Edge 113+ on desktop for full
generation.

## Run it

```bash
cp .env.example .env.local      # optional; defaults point at localhost:8000
npm install
npm run dev                     # http://localhost:3000
```

The backend must be running (see `../backend`) and its `CORS_ORIGINS` must
include this origin (the compose default already allows `http://localhost:3000`).

Build / checks:

```bash
npm run build       # production build (static-friendly)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (next/core-web-vitals)
```

## Configuration (`.env.example`)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (default `http://localhost:8000`) |
| `NEXT_PUBLIC_DEFAULT_MODEL` | Default WebLLM model id |
| `NEXT_PUBLIC_EMBED_MODEL` | Embedding model — **must match the backend in fat-server mode** |

## Cross-origin isolation (critical)

WebGPU + threaded WASM require `crossOriginIsolated === true`. `next.config.mjs`
sets:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

`credentialless` (vs the spec’s `require-corp`) lets model/runtime assets load
from the HF / jsDelivr / MLC CDNs without each one sending CORP headers. Both
yield cross-origin isolation. Replicate these headers on whatever host you
deploy to (Vercel/Cloudflare), or WebLLM will silently fail to start.

## Notable implementation choices

- **Transformers.js is loaded from a CDN inside the embed worker** at runtime
  (`webpackIgnore`), not bundled — its onnxruntime dep ships native node assets
  that break webpack/Terser. The browser loads the ESM directly; `credentialless`
  COEP allows it.
- **Two web workers** keep the UI thread free: WebLLM generation and
  Transformers.js embeddings run off-main-thread.
- **Voy** (Rust→WASM HNSW) for search, with a brute-force cosine fallback and a
  keyword search for exact terms the embedder misses.

## Limitations

- In-browser vector search degrades past ~5k–10k chunks (surfaced in the UI as a
  warning). For larger sites use the backend’s `fat-server` mode.
- First model load is a 0.5–2.5 GB download (cached afterward in IndexedDB).
