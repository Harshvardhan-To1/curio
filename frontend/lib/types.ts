/** A cleaned corpus chunk as served by the backend `/corpus` endpoint. */
export interface CorpusChunk {
  chunkId: string;
  sourceUrl: string;
  pageTitle: string;
  headingPath: string[];
  position: number;
  text: string;
  tokenEstimate: number;
  crawledAt: string;
  embedding?: number[] | null; // present only in fat-server mode
}

export interface CorpusResponse {
  jobId: string;
  embedMode: 'thin-server' | 'fat-server';
  embedModel: string | null;
  total: number;
  offset: number;
  limit: number;
  chunks: CorpusChunk[];
}

export interface CrawlStatus {
  jobId: string;
  seedUrl: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  embedMode: 'thin-server' | 'fat-server';
  pagesFound: number;
  pagesDone: number;
  chunkCount: number;
  errors: { url: string; message: string; at: string }[];
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ProgressEvent {
  type: 'state' | 'page' | 'error' | 'done';
  jobId: string;
  state?: string;
  pagesFound?: number;
  pagesDone?: number;
  chunkCount?: number;
  url?: string;
  message?: string;
  at: string;
}

/** A retrieved chunk plus its similarity score, used to build context + cites. */
export interface RetrievedChunk extends CorpusChunk {
  score: number;
}

export interface Citation {
  sourceUrl: string;
  pageTitle: string;
}

export type ToolName =
  | 'retrieve'
  | 'keyword_search'
  | 'list_pages'
  | 'get_page'
  | 'fetch_more';

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface ToolTraceEntry {
  step: number;
  tool: ToolName;
  args: Record<string, unknown>;
  observation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  trace?: ToolTraceEntry[];
  /** True while tokens are still streaming in. */
  streaming?: boolean;
  /** True if we fell back to single-shot RAG (agent failed/looped). */
  fallback?: boolean;
  error?: string;
}
