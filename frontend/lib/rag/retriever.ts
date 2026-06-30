import { fetchMorePage } from '../api';
import { EmbedClient } from '../engine/embed-client';
import { VoyStore } from '../vector/voy-store';
import type { RetrievedChunk } from '../types';
import { RETRIEVE_K } from '../config';

/**
 * Bundles the vector store + embedder + backend so the agent's tools have a
 * single, simple surface to call. Query embedding uses the SAME model as the
 * corpus, guaranteeing retrieval parity.
 */
export class RagEngine {
  constructor(
    private readonly jobId: string,
    private readonly store: VoyStore,
    private readonly embedder: EmbedClient,
  ) {}

  get corpusSize() {
    return this.store.size;
  }

  async retrieve(query: string, k = RETRIEVE_K): Promise<RetrievedChunk[]> {
    const vec = await this.embedder.embedOne(query);
    return this.store.search(vec, k);
  }

  keywordSearch(term: string, k = RETRIEVE_K): RetrievedChunk[] {
    return this.store.keywordSearch(term, k);
  }

  listPages() {
    return this.store.listPages();
  }

  getPage(url: string): RetrievedChunk[] {
    return this.store.getPage(url);
  }

  /** Crawl one more page on demand, embed it, and fold it into the index. */
  async fetchMore(url: string): Promise<RetrievedChunk[]> {
    const { chunks } = await fetchMorePage(this.jobId, url);
    if (!chunks.length) return [];
    const vectors = await this.embedder.embedAll(chunks.map((c) => c.text));
    await this.store.append(chunks, vectors);
    return chunks.map((c) => ({ ...c, score: 1 }));
  }
}
