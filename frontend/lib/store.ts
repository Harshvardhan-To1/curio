import { create } from 'zustand';
import type { Capabilities } from './capabilities';
import type { ChatMessage, CrawlStatus } from './types';
import type { SessionMeta } from './idb';
import { DEFAULT_MODEL } from './config';

export type Phase =
  | 'gate'
  | 'idle'
  | 'crawling'
  | 'indexing'
  | 'loading-model'
  | 'ready'
  | 'error';

interface AppState {
  phase: Phase;
  capabilities: Capabilities | null;
  degraded: boolean; // WebGPU unavailable → no in-browser generation

  jobId: string | null;
  seedUrl: string | null;
  crawlStatus: CrawlStatus | null;
  recentEvents: string[];

  modelId: string;
  modelProgress: { progress: number; text: string } | null;
  embedBackend: string | null;
  embedProgress: { done: number; total: number } | null;
  indexProgress: { done: number; total: number } | null;
  corpusSize: number;
  largeCorpusWarning: boolean;

  messages: ChatMessage[];
  thinking: boolean;
  sessions: SessionMeta[];

  error: string | null;

  // setters
  set: (patch: Partial<AppState>) => void;
  setModel: (id: string) => void;
  pushEvent: (line: string) => void;
  addMessage: (m: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  reset: () => void;
}

const initial = {
  phase: 'gate' as Phase,
  capabilities: null,
  degraded: false,
  jobId: null,
  seedUrl: null,
  crawlStatus: null,
  recentEvents: [],
  modelId: DEFAULT_MODEL,
  modelProgress: null,
  embedBackend: null,
  embedProgress: null,
  indexProgress: null,
  corpusSize: 0,
  largeCorpusWarning: false,
  messages: [],
  thinking: false,
  sessions: [],
  error: null,
};

export const useStore = create<AppState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  setModel: (id) => set({ modelId: id }),
  pushEvent: (line) =>
    set((s) => ({ recentEvents: [line, ...s.recentEvents].slice(0, 8) })),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  reset: () =>
    set({
      phase: 'idle',
      jobId: null,
      seedUrl: null,
      crawlStatus: null,
      recentEvents: [],
      modelProgress: null,
      embedProgress: null,
      indexProgress: null,
      corpusSize: 0,
      largeCorpusWarning: false,
      messages: [],
      thinking: false,
      error: null,
    }),
}));
