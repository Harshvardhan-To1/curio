import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { LlmClient } from '../engine/llm-client';
import { RagEngine } from './retriever';
import {
  AGENT_SYSTEM,
  agentStepUser,
  answerSystem,
  answerUser,
  buildContextBlock,
} from './prompt';
import { MAX_AGENT_STEPS, RETRIEVE_K } from '../config';
import type {
  Citation,
  RetrievedChunk,
  ToolCall,
  ToolName,
  ToolTraceEntry,
} from '../types';

export interface AgentCallbacks {
  onToken: (delta: string) => void;
  onTrace: (entry: ToolTraceEntry) => void;
}

export interface AgentResult {
  citations: Citation[];
  trace: ToolTraceEntry[];
  fallback: boolean;
}

const VALID_TOOLS: ToolName[] = [
  'retrieve',
  'keyword_search',
  'list_pages',
  'get_page',
  'fetch_more',
];

/** Extract the first JSON object from a model reply, tolerating stray prose. */
function parseAction(raw: string): ToolCall | { tool: 'answer' } | null {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (obj.tool === 'answer') return { tool: 'answer' };
    if (VALID_TOOLS.includes(obj.tool)) {
      return { tool: obj.tool, args: obj.args ?? {} };
    }
    return null;
  } catch {
    return null;
  }
}

function dedupe(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const c of chunks) {
    if (seen.has(c.chunkId)) continue;
    seen.add(c.chunkId);
    out.push(c);
  }
  return out;
}

/**
 * Limit how many chunks come from any single page so the context isn't a wall
 * of near-identical passages (which pushes small models into repetition loops).
 */
function capPerPage(chunks: RetrievedChunk[], perPage: number): RetrievedChunk[] {
  const counts = new Map<string, number>();
  const out: RetrievedChunk[] = [];
  for (const c of chunks) {
    const n = counts.get(c.sourceUrl) ?? 0;
    if (n >= perPage) continue;
    counts.set(c.sourceUrl, n + 1);
    out.push(c);
  }
  return out;
}

function citationsFrom(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Map<string, string>();
  for (const c of chunks) {
    if (!seen.has(c.sourceUrl)) seen.set(c.sourceUrl, c.pageTitle);
  }
  return [...seen.entries()].map(([sourceUrl, pageTitle]) => ({
    sourceUrl,
    pageTitle,
  }));
}

/**
 * Constrained ReAct loop (spec §4.4): the model emits JSON actions, we run the
 * tool, append the observation, and repeat — capped at MAX_AGENT_STEPS. Two bad
 * JSON replies trigger a graceful fall back to plain single-shot RAG.
 */
export async function answerQuestion(
  question: string,
  llm: LlmClient,
  rag: RagEngine,
  cb: AgentCallbacks,
): Promise<AgentResult> {
  const trace: ToolTraceEntry[] = [];
  let context: RetrievedChunk[] = [];
  let badJson = 0;

  // Seed with one semantic retrieve up front: it's fast, guarantees grounding,
  // gives the user immediate visible progress, and lets the small model usually
  // answer in a single follow-up step instead of burning a turn on "retrieve".
  try {
    const seed = await rag.retrieve(question);
    if (seed.length) {
      context = dedupe(seed);
      const entry: ToolTraceEntry = {
        step: 0,
        tool: 'retrieve',
        args: { query: question },
        observation: summarize(seed),
      };
      trace.push(entry);
      cb.onTrace(entry);
    }
  } catch {
    /* fall through to the agent loop */
  }

  for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
    let raw: string;
    try {
      // NOTE: we deliberately do NOT use WebLLM's json_object response_format —
      // its grammar compiler is unstable in-browser. The few-shot prompt + the
      // lenient parseAction() below give us reliable JSON without it.
      raw = await llm.complete(
        [
          { role: 'system', content: AGENT_SYSTEM },
          { role: 'user', content: agentStepUser(question, trace) },
        ],
        { temperature: 0.1, maxTokens: 200 },
      );
    } catch {
      return finalize(question, llm, rag, context, cb, trace, true);
    }

    const action = parseAction(raw);
    if (!action) {
      if (++badJson >= 2) {
        return finalize(question, llm, rag, context, cb, trace, true);
      }
      continue;
    }
    if (action.tool === 'answer') break;

    const { observation, found } = await runTool(action, rag);
    context = dedupe([...context, ...found]);
    const entry: ToolTraceEntry = {
      step,
      tool: action.tool,
      args: action.args,
      observation,
    };
    trace.push(entry);
    cb.onTrace(entry);
  }

  return finalize(question, llm, rag, context, cb, trace, false);
}

async function runTool(
  action: ToolCall,
  rag: RagEngine,
): Promise<{ observation: string; found: RetrievedChunk[] }> {
  try {
    switch (action.tool) {
      case 'retrieve': {
        const q = String(action.args.query ?? '');
        const found = await rag.retrieve(q || ' ');
        return { observation: summarize(found), found };
      }
      case 'keyword_search': {
        const found = rag.keywordSearch(String(action.args.term ?? ''));
        return {
          observation: found.length ? summarize(found) : 'No exact matches.',
          found,
        };
      }
      case 'list_pages': {
        const pages = rag.listPages().slice(0, 30);
        return {
          observation: pages
            .map((p) => `${p.pageTitle} — ${p.sourceUrl}`)
            .join('\n'),
          found: [],
        };
      }
      case 'get_page': {
        const found = rag.getPage(String(action.args.url ?? ''));
        return {
          observation: found.length
            ? `Loaded ${found.length} sections from page.`
            : 'Page not found in corpus.',
          found,
        };
      }
      case 'fetch_more': {
        const found = await rag.fetchMore(String(action.args.url ?? ''));
        return {
          observation: found.length
            ? `Crawled page; added ${found.length} sections.`
            : 'Nothing fetched.',
          found,
        };
      }
    }
  } catch (err) {
    return { observation: `Tool error: ${(err as Error).message}`, found: [] };
  }
}

function summarize(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return 'No results.';
  return chunks
    .slice(0, RETRIEVE_K)
    .map((c, i) => `(${i + 1}) ${c.pageTitle}: ${c.text.slice(0, 120)}…`)
    .join('\n');
}

/** Stream the final grounded answer and compute citations. */
async function finalize(
  question: string,
  llm: LlmClient,
  rag: RagEngine,
  context: RetrievedChunk[],
  cb: AgentCallbacks,
  trace: ToolTraceEntry[],
  fallback: boolean,
): Promise<AgentResult> {
  // Ensure we always have something to ground on, capped so one page can't
  // dominate the context (avoids small-model repetition loops).
  const base = context.length > 0 ? context : await safeRetrieve(question, rag);
  const grounded = capPerPage(base, 2).slice(0, 6);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: answerSystem() },
    { role: 'user', content: answerUser(question, buildContextBlock(grounded)) },
  ];

  try {
    let full = '';
    let lastLine = '';
    let repeats = 0;
    for await (const delta of llm.stream(messages, {
      temperature: 0.3,
      maxTokens: 400,
      frequencyPenalty: 0.5,
      presencePenalty: 0.4,
    })) {
      cb.onToken(delta);
      full += delta;
      // Safety net: bail if the model loops the same line 3× in a row.
      if (delta.includes('\n')) {
        const lines = full.split('\n').filter((l) => l.trim().length > 8);
        const completed = lines[lines.length - 2];
        if (completed && completed === lastLine) {
          if (++repeats >= 2) break;
        } else {
          lastLine = completed ?? lastLine;
          repeats = 0;
        }
      }
    }
  } catch (err) {
    cb.onToken(`\n\n_Generation error: ${(err as Error).message}_`);
  }

  return { citations: citationsFrom(grounded), trace, fallback };
}

async function safeRetrieve(
  question: string,
  rag: RagEngine,
): Promise<RetrievedChunk[]> {
  try {
    return await rag.retrieve(question);
  } catch {
    return [];
  }
}
