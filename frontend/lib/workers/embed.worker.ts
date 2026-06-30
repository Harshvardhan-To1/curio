/// <reference lib="webworker" />
/**
 * Embeddings worker (Transformers.js). Runs feature-extraction off the UI
 * thread, mean-pooled + L2-normalized to match the backend's fat-server
 * vectors. Tries WebGPU, falls back to WASM.
 *
 * Transformers.js is imported from a CDN at RUNTIME (webpackIgnore) rather than
 * bundled, because its onnxruntime dependency ships native node assets that
 * break webpack/Terser. The browser (module worker) loads the ESM directly;
 * COEP `credentialless` lets these cross-origin assets through.
 */
import type { FeatureExtractionPipeline } from '@huggingface/transformers';

const TF_VERSION = '3.3.1';
const TF_CDN = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TF_VERSION}`;

type TfModule = typeof import('@huggingface/transformers');

type InMessage =
  | { type: 'init'; model: string }
  | { type: 'embed'; id: number; texts: string[] };

type OutMessage =
  | { type: 'ready'; backend: string }
  | { type: 'progress'; loaded: number; total: number; file: string }
  | { type: 'embedded'; id: number; vectors: number[][] }
  | { type: 'error'; id?: number; message: string };

let extractor: FeatureExtractionPipeline | null = null;
let backend = 'wasm';

async function loadTransformers(): Promise<TfModule> {
  const mod = (await import(/* webpackIgnore: true */ TF_CDN)) as TfModule;
  mod.env.allowLocalModels = false; // download models from the HF hub, then cache
  return mod;
}

async function init(model: string) {
  const tf = await loadTransformers();
  const onProgress = (p: {
    status: string;
    loaded?: number;
    total?: number;
    file?: string;
  }) => {
    if (p.status === 'progress') {
      post({
        type: 'progress',
        loaded: p.loaded ?? 0,
        total: p.total ?? 0,
        file: p.file ?? '',
      });
    }
  };
  // pipeline()'s overload union is enormous and blows up tsc; narrow it.
  const pl = tf.pipeline as unknown as (
    task: 'feature-extraction',
    model: string,
    options?: object,
  ) => Promise<FeatureExtractionPipeline>;
  try {
    extractor = await pl('feature-extraction', model, {
      device: 'webgpu',
      progress_callback: onProgress,
    });
    backend = 'webgpu';
  } catch {
    extractor = await pl('feature-extraction', model, {
      progress_callback: onProgress,
    });
    backend = 'wasm';
  }
  post({ type: 'ready', backend });
}

async function embed(id: number, texts: string[]) {
  if (!extractor) throw new Error('Embedder not initialized');
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  post({ type: 'embedded', id, vectors: output.tolist() as number[][] });
}

function post(msg: OutMessage) {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') await init(msg.model);
    else if (msg.type === 'embed') await embed(msg.id, msg.texts);
  } catch (err) {
    post({
      type: 'error',
      id: 'id' in msg ? (msg as { id: number }).id : undefined,
      message: (err as Error).message,
    });
  }
};

export {};
