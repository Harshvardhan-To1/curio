export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const DEFAULT_MODEL =
  process.env.NEXT_PUBLIC_DEFAULT_MODEL ??
  'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export const EMBED_MODEL =
  process.env.NEXT_PUBLIC_EMBED_MODEL ?? 'Xenova/all-MiniLM-L6-v2';

/** Browser vector search degrades past this; surfaced in the UI (spec §5). */
export const MAX_COMFORTABLE_CHUNKS = 5000;

/** Retrieval defaults. */
export const RETRIEVE_K = 5;

/** Hard cap on agent tool-use iterations before forcing an answer (spec §4.4). */
export const MAX_AGENT_STEPS = 4;
