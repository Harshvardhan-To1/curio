import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CorpusChunk } from './types';

export interface StoredCorpus {
  jobId: string;
  seedUrl: string;
  embedModel: string;
  chunks: CorpusChunk[];
  vectors: number[][];
  savedAt: number;
}

export interface SessionMeta {
  jobId: string;
  seedUrl: string;
  chunkCount: number;
  savedAt: number;
}

interface SiteRagDB extends DBSchema {
  corpora: {
    key: string;
    value: StoredCorpus;
  };
}

let dbPromise: Promise<IDBPDatabase<SiteRagDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<SiteRagDB>('siterag', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('corpora')) {
          database.createObjectStore('corpora', { keyPath: 'jobId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCorpus(corpus: StoredCorpus): Promise<void> {
  await (await db()).put('corpora', corpus);
}

export async function loadCorpus(jobId: string): Promise<StoredCorpus | undefined> {
  return (await db()).get('corpora', jobId);
}

export async function deleteCorpus(jobId: string): Promise<void> {
  await (await db()).delete('corpora', jobId);
}

export async function listSessions(): Promise<SessionMeta[]> {
  const all = await (await db()).getAll('corpora');
  return all
    .map((c) => ({
      jobId: c.jobId,
      seedUrl: c.seedUrl,
      chunkCount: c.chunks.length,
      savedAt: c.savedAt,
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
