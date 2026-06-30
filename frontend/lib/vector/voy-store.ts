import type { CorpusChunk, RetrievedChunk } from '../types';

/**
 * Vector store over the corpus. Uses Voy (Rust→WASM HNSW) when available, and
 * falls back to brute-force cosine for tiny corpora or if Voy fails to load.
 * Also exposes a keyword search for exact-match terms the embedder misses.
 *
 * Voy is dynamically imported so the WASM only loads in the browser.
 */
export class VoyStore {
  private chunks: CorpusChunk[] = [];
  private vectors: number[][] = [];
  private voy: unknown | null = null;
  private idToIndex = new Map<string, number>();

  get size() {
    return this.chunks.length;
  }

  async build(chunks: CorpusChunk[], vectors: number[][]): Promise<void> {
    // Degenerate inputs (e.g. an empty chunk mean-pooled to 0/0) can yield
    // NaN/Infinity, which JSON-serialize to null and make Voy's f32 parser
    // throw. Clamp every component to a finite number before indexing.
    this.chunks = chunks;
    this.vectors = vectors.map(sanitizeVector);
    chunks.forEach((c, i) => this.idToIndex.set(c.chunkId, i));

    try {
      const { Voy } = await import('voy-search');
      const resource = {
        embeddings: chunks.map((c, i) => ({
          id: c.chunkId,
          title: c.pageTitle,
          url: c.sourceUrl,
          embeddings: this.vectors[i],
        })),
      };
      this.voy = new Voy(resource);
    } catch (err) {
      // Brute-force fallback keeps search working without the WASM index.
      console.warn('Voy unavailable, using brute-force cosine:', err);
      this.voy = null;
    }
  }

  search(queryVec: number[], k: number): RetrievedChunk[] {
    if (!this.chunks.length) return [];

    if (this.voy) {
      try {
        const q = Float32Array.from(queryVec);
        const result = (
          this.voy as {
            search: (q: Float32Array, k: number) => { neighbors: { id: string }[] };
          }
        ).search(q, k);
        return result.neighbors
          .map((n) => {
            const idx = this.idToIndex.get(n.id);
            if (idx === undefined) return null;
            return {
              ...this.chunks[idx],
              score: cosine(queryVec, this.vectors[idx]),
            };
          })
          .filter((x): x is RetrievedChunk => x !== null);
      } catch (err) {
        console.warn('Voy search failed, falling back:', err);
      }
    }

    return this.bruteForce(queryVec, k);
  }

  private bruteForce(queryVec: number[], k: number): RetrievedChunk[] {
    return this.chunks
      .map((c, i) => ({ ...c, score: cosine(queryVec, this.vectors[i]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** Exact-ish keyword fallback for names/IDs (spec §4.4 keyword_search). */
  keywordSearch(term: string, k: number): RetrievedChunk[] {
    const needle = term.toLowerCase().trim();
    if (!needle) return [];
    return this.chunks
      .map((c) => {
        const hay = (c.text + ' ' + c.pageTitle).toLowerCase();
        let score = 0;
        let from = 0;
        while (true) {
          const at = hay.indexOf(needle, from);
          if (at === -1) break;
          score++;
          from = at + needle.length;
        }
        return { ...c, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  listPages(): { sourceUrl: string; pageTitle: string }[] {
    const seen = new Map<string, string>();
    for (const c of this.chunks) {
      if (!seen.has(c.sourceUrl)) seen.set(c.sourceUrl, c.pageTitle);
    }
    return [...seen.entries()].map(([sourceUrl, pageTitle]) => ({
      sourceUrl,
      pageTitle,
    }));
  }

  getPage(url: string): RetrievedChunk[] {
    return this.chunks
      .filter((c) => c.sourceUrl === url)
      .map((c) => ({ ...c, score: 1 }));
  }

  /** Append newly fetched chunks + vectors (agent fetch_more). */
  async append(chunks: CorpusChunk[], vectors: number[][]): Promise<void> {
    if (!chunks.length) return;
    await this.build(
      [...this.chunks, ...chunks],
      [...this.vectors, ...vectors],
    );
  }
}

/** Replace NaN/±Infinity with 0 so the vector is valid f32 JSON for Voy. */
export function sanitizeVector(v: number[]): number[] {
  let dirty = false;
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i])) {
      dirty = true;
      break;
    }
  }
  if (!dirty) return v;
  return v.map((x) => (Number.isFinite(x) ? x : 0));
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
