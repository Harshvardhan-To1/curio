import { API_URL } from './config';
import type {
  CorpusChunk,
  CorpusResponse,
  CrawlStatus,
  ProgressEvent,
} from './types';

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  sameOriginOnly?: boolean;
  respectRobots?: boolean;
  requestsPerSecond?: number;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function startCrawl(
  url: string,
  options?: CrawlOptions,
): Promise<{ jobId: string }> {
  const res = await fetch(`${API_URL}/api/crawl`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, options }),
  });
  return jsonOrThrow(res);
}

export async function getStatus(jobId: string): Promise<CrawlStatus> {
  return jsonOrThrow(await fetch(`${API_URL}/api/crawl/${jobId}/status`));
}

/**
 * Subscribe to live crawl progress over SSE. Returns an unsubscribe fn.
 * Falls back silently to status polling is the caller's responsibility.
 */
export function streamProgress(
  jobId: string,
  onEvent: (e: ProgressEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(`${API_URL}/api/crawl/${jobId}/stream`);
  const handler = (ev: MessageEvent) => {
    try {
      onEvent(JSON.parse(ev.data) as ProgressEvent);
    } catch {
      /* ignore malformed frame */
    }
  };
  // The backend tags events by type; listen to each plus the default.
  ['state', 'page', 'error', 'done', 'message'].forEach((t) =>
    es.addEventListener(t, handler as EventListener),
  );
  es.onerror = (e) => onError?.(e);
  return () => es.close();
}

export async function getCorpusPage(
  jobId: string,
  offset: number,
  limit: number,
): Promise<CorpusResponse> {
  return jsonOrThrow(
    await fetch(
      `${API_URL}/api/crawl/${jobId}/corpus?offset=${offset}&limit=${limit}`,
    ),
  );
}

/** Pull the entire corpus, page by page. */
export async function getFullCorpus(
  jobId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ chunks: CorpusChunk[]; embedMode: string; embedModel: string | null }> {
  const limit = 200;
  const first = await getCorpusPage(jobId, 0, limit);
  const chunks = [...first.chunks];
  onProgress?.(chunks.length, first.total);
  while (chunks.length < first.total) {
    const page = await getCorpusPage(jobId, chunks.length, limit);
    if (!page.chunks.length) break;
    chunks.push(...page.chunks);
    onProgress?.(chunks.length, first.total);
  }
  return { chunks, embedMode: first.embedMode, embedModel: first.embedModel };
}

/** Ask the backend to crawl one more page on demand (agent fetch_more tool). */
export async function fetchMorePage(
  jobId: string,
  url: string,
): Promise<{ added: number; chunks: CorpusChunk[] }> {
  const res = await fetch(`${API_URL}/api/crawl/${jobId}/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return jsonOrThrow(res);
}
