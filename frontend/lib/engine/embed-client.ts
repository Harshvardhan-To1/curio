import { EMBED_MODEL } from '../config';

export interface EmbedProgress {
  loaded: number;
  total: number;
  file: string;
}

/**
 * Main-thread handle to the embeddings worker. Promise-based: init() resolves
 * when the model is loaded; embed() resolves with vectors for a batch.
 */
export class EmbedClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: number[][]) => void; reject: (e: Error) => void }
  >();
  private readyResolve: ((backend: string) => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  backend = 'wasm';

  async init(onProgress?: (p: EmbedProgress) => void): Promise<string> {
    this.worker = new Worker(
      new URL('../workers/embed.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          this.backend = msg.backend;
          this.readyResolve?.(msg.backend);
          break;
        case 'progress':
          onProgress?.(msg);
          break;
        case 'embedded': {
          this.pending.get(msg.id)?.resolve(msg.vectors);
          this.pending.delete(msg.id);
          break;
        }
        case 'error': {
          const err = new Error(msg.message);
          if (msg.id != null && this.pending.has(msg.id)) {
            this.pending.get(msg.id)!.reject(err);
            this.pending.delete(msg.id);
          } else {
            this.readyReject?.(err);
          }
          break;
        }
      }
    };
    const ready = new Promise<string>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.worker.postMessage({ type: 'init', model: EMBED_MODEL });
    return ready;
  }

  embed(texts: string[]): Promise<number[][]> {
    if (!this.worker) throw new Error('EmbedClient not initialized');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'embed', id, texts });
    });
  }

  /** Embed a list in batches, reporting progress between batches. */
  async embedAll(
    texts: string[],
    batchSize = 32,
    onProgress?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const vecs = await this.embed(batch);
      out.push(...vecs);
      onProgress?.(Math.min(i + batchSize, texts.length), texts.length);
    }
    return out;
  }

  async embedOne(text: string): Promise<number[]> {
    return (await this.embed([text]))[0];
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
