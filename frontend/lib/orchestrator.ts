import { useStore } from './store';
import { LlmClient } from './engine/llm-client';
import { EmbedClient } from './engine/embed-client';
import { VoyStore } from './vector/voy-store';
import { RagEngine } from './rag/retriever';
import { answerQuestion } from './rag/agent';
import {
  getFullCorpus,
  getStatus,
  startCrawl,
  streamProgress,
  type CrawlOptions,
} from './api';
import { saveCorpus, loadCorpus, listSessions } from './idb';
import { EMBED_MODEL, MAX_COMFORTABLE_CHUNKS } from './config';
import { hostOf, uid } from './utils';
import type { ChatMessage, RetrievedChunk } from './types';

/** Long-lived, non-serializable engine handles live outside React state. */
const engines: {
  llm: LlmClient;
  embed: EmbedClient;
  store: VoyStore;
  rag: RagEngine | null;
} = {
  llm: new LlmClient(),
  embed: new EmbedClient(),
  store: new VoyStore(),
  rag: null,
};

let modelPromise: Promise<void> | null = null;
let embedPromise: Promise<string> | null = null;

const st = () => useStore.getState();

function ensureEmbedder(): Promise<string> {
  if (!embedPromise) {
    embedPromise = engines.embed
      .init((p) => {
        if (p.total) {
          st().set({ embedProgress: { done: p.loaded, total: p.total } });
        }
      })
      .then((backend) => {
        st().set({ embedBackend: backend, embedProgress: null });
        return backend;
      });
  }
  return embedPromise;
}

function ensureModel(): Promise<void> {
  if (st().degraded) return Promise.resolve();
  if (engines.llm.ready) return Promise.resolve();
  if (!modelPromise) {
    modelPromise = engines.llm.load(st().modelId, (p) =>
      st().set({ modelProgress: p }),
    );
  }
  return modelPromise;
}

/** Embed all chunk texts in batches, reporting progress to the store. */
async function indexCorpus(
  chunks: { text: string }[],
): Promise<number[][]> {
  await ensureEmbedder();
  st().set({ indexProgress: { done: 0, total: chunks.length } });
  return engines.embed.embedAll(
    chunks.map((c) => c.text),
    32,
    (done, total) => st().set({ indexProgress: { done, total } }),
  );
}

/** Full new-site flow: crawl → corpus → embed → index → (model) → ready. */
export async function startSession(url: string, options?: CrawlOptions) {
  const store = st();
  store.reset();
  store.set({ phase: 'crawling', seedUrl: url });

  // Warm up the embedder and (unless degraded) the model in parallel.
  ensureEmbedder().catch(() => undefined);
  ensureModel().catch((e) =>
    store.set({ error: `Model load failed: ${(e as Error).message}` }),
  );

  let jobId: string;
  try {
    ({ jobId } = await startCrawl(url, options));
  } catch (e) {
    store.set({ phase: 'error', error: `Crawl failed: ${(e as Error).message}` });
    return;
  }
  store.set({ jobId });

  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    unsub();
    await indexAndReady(jobId, url);
  };

  const unsub = streamProgress(
    jobId,
    (ev) => {
      st().set({
        crawlStatus: {
          ...(st().crawlStatus ?? ({} as never)),
          jobId,
          seedUrl: url,
          state: (ev.state as never) ?? 'running',
          pagesFound: ev.pagesFound ?? st().crawlStatus?.pagesFound ?? 0,
          pagesDone: ev.pagesDone ?? st().crawlStatus?.pagesDone ?? 0,
          chunkCount: ev.chunkCount ?? st().crawlStatus?.chunkCount ?? 0,
        } as never,
      });
      if (ev.url) st().pushEvent(`crawled ${ev.url}`);
      if (ev.type === 'done') finish();
    },
    () => undefined,
  );

  // Safety net: poll status in case the SSE stream drops.
  const poll = setInterval(async () => {
    if (done) return clearInterval(poll);
    try {
      const status = await getStatus(jobId);
      st().set({ crawlStatus: status });
      if (status.state === 'completed' || status.state === 'failed') {
        clearInterval(poll);
        finish();
      }
    } catch {
      /* keep trying */
    }
  }, 3000);
}

async function indexAndReady(jobId: string, url: string) {
  const store = st();
  try {
    store.set({ phase: 'indexing' });
    const { chunks } = await getFullCorpus(jobId);
    if (!chunks.length) {
      store.set({
        phase: 'error',
        error: 'The crawl produced no readable content for this site.',
      });
      return;
    }
    store.set({
      corpusSize: chunks.length,
      largeCorpusWarning: chunks.length > MAX_COMFORTABLE_CHUNKS,
    });

    const vectors = await indexCorpus(chunks);
    await engines.store.build(chunks, vectors);
    engines.rag = new RagEngine(jobId, engines.store, engines.embed);

    await saveCorpus({
      jobId,
      seedUrl: url,
      embedModel: EMBED_MODEL,
      chunks,
      vectors,
      savedAt: Date.now(),
    });
    refreshSessions();

    if (!store.degraded) {
      store.set({ phase: 'loading-model' });
      await ensureModel();
    }
    st().set({ phase: 'ready', indexProgress: null });
    greet(url);
  } catch (e) {
    st().set({ phase: 'error', error: `Indexing failed: ${(e as Error).message}` });
  }
}

/** Restore a previously indexed site from IndexedDB (offline-friendly). */
export async function restoreSession(jobId: string) {
  const store = st();
  store.reset();
  store.set({ phase: 'indexing', jobId });
  try {
    const saved = await loadCorpus(jobId);
    if (!saved) {
      store.set({ phase: 'idle', error: 'Session not found locally.' });
      return;
    }
    store.set({ seedUrl: saved.seedUrl, corpusSize: saved.chunks.length });
    await ensureEmbedder(); // needed to embed queries
    await engines.store.build(saved.chunks, saved.vectors);
    engines.rag = new RagEngine(jobId, engines.store, engines.embed);

    if (!store.degraded) {
      store.set({ phase: 'loading-model' });
      await ensureModel();
    }
    st().set({ phase: 'ready' });
    greet(saved.seedUrl);
  } catch (e) {
    st().set({ phase: 'error', error: `Restore failed: ${(e as Error).message}` });
  }
}

function greet(url: string) {
  if (st().messages.length) return;
  st().addMessage({
    id: uid(),
    role: 'assistant',
    content: st().degraded
      ? `I indexed **${hostOf(url)}**. WebGPU isn't available, so I'll show the most relevant passages instead of a written answer.`
      : `I've read **${hostOf(url)}** and I'm ready. Ask me anything about it.`,
  });
}

export async function sendMessage(text: string) {
  const store = st();
  if (!text.trim() || store.thinking) return;

  store.addMessage({ id: uid(), role: 'user', content: text });
  const assistantId = uid();
  store.addMessage({
    id: assistantId,
    role: 'assistant',
    content: '',
    streaming: true,
    trace: [],
  });
  store.set({ thinking: true });

  // Degraded mode: retrieval-only preview, no generation.
  if (store.degraded || !engines.llm.ready) {
    if (store.degraded) {
      await retrievalOnly(text, assistantId);
      store.set({ thinking: false });
      return;
    }
  }

  try {
    const result = await answerQuestion(text, engines.llm, engines.rag!, {
      onToken: (delta) =>
        st().updateMessage(assistantId, {
          content:
            (st().messages.find((m) => m.id === assistantId)?.content ?? '') +
            delta,
        }),
      onTrace: (entry) =>
        st().updateMessage(assistantId, {
          trace: [
            ...(st().messages.find((m) => m.id === assistantId)?.trace ?? []),
            entry,
          ],
        }),
    });
    st().updateMessage(assistantId, {
      streaming: false,
      citations: result.citations,
      fallback: result.fallback,
    });
  } catch (e) {
    st().updateMessage(assistantId, {
      streaming: false,
      error: (e as Error).message,
      content:
        (st().messages.find((m) => m.id === assistantId)?.content ?? '') ||
        `Sorry — something went wrong: ${(e as Error).message}`,
    });
  } finally {
    st().set({ thinking: false });
  }
}

async function retrievalOnly(text: string, assistantId: string) {
  let found: RetrievedChunk[] = [];
  try {
    found = await engines.rag!.retrieve(text);
  } catch {
    /* ignore */
  }
  const body = found.length
    ? found
        .map((c, i) => `**[${i + 1}] ${c.pageTitle}**\n\n${c.text.slice(0, 400)}…`)
        .join('\n\n')
    : 'No relevant passages found on this site.';
  st().updateMessage(assistantId, {
    streaming: false,
    content: body,
    citations: found.map((c) => ({
      sourceUrl: c.sourceUrl,
      pageTitle: c.pageTitle,
    })),
  });
}

export async function refreshSessions() {
  try {
    st().set({ sessions: await listSessions() });
  } catch {
    /* ignore */
  }
}

export function getEngines() {
  return engines;
}
