import type { RetrievedChunk, ToolTraceEntry } from '../types';

/**
 * Prompts are deliberately short and explicit with a worked example - small
 * (1–3B) models need the scaffolding to emit reliable JSON actions (spec §4.4).
 */

export const AGENT_SYSTEM = `You are Curio, an assistant that answers questions about ONE website using only its crawled content.

You work in steps. At each step you choose ONE action and reply with a SINGLE JSON object, nothing else.

Available tools:
- {"tool":"retrieve","args":{"query":"<search text>"}} - semantic search over the site (use this first).
- {"tool":"keyword_search","args":{"term":"<exact word/name/id>"}} - exact match for names, codes, emails.
- {"tool":"list_pages","args":{}} - list the crawled page titles + URLs.
- {"tool":"get_page","args":{"url":"<page url>"}} - read one specific page fully.
- {"tool":"fetch_more","args":{"url":"<page url>"}} - ask the server to crawl one more page if needed.
- {"tool":"answer","args":{}} - you have enough context; stop and write the final answer.

Rules:
- An initial semantic search has ALREADY been run for you (see "Actions so far").
  In most cases the results are enough - choose "answer".
- Only use another tool if the results clearly miss the question (e.g. an exact
  name/email → "keyword_search"; a specific page → "get_page").
- Use at most a couple of extra steps. When in doubt, choose "answer".
- Reply with ONLY the JSON object. No prose, no markdown fences.

Example:
Question: "What is the admission email?" (search returned no email)
Your reply: {"tool":"keyword_search","args":{"term":"admission"}}`;

export function agentStepUser(
  question: string,
  trace: ToolTraceEntry[],
): string {
  const history =
    trace.length === 0
      ? '(no actions taken yet)'
      : trace
          .map(
            (t) =>
              `Step ${t.step}: ${t.tool}(${JSON.stringify(t.args)}) -> ${t.observation}`,
          )
          .join('\n');
  return `Question: ${question}

Actions so far:
${history}

Choose the next action as a single JSON object.`;
}

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const heading = c.headingPath.length ? ` (${c.headingPath.join(' › ')})` : '';
      return `[${i + 1}] ${c.pageTitle}${heading}\nURL: ${c.sourceUrl}\n${c.text}`;
    })
    .join('\n\n---\n\n');
}

export function answerSystem(): string {
  return `You are Curio. Answer the user's question using ONLY the provided context from the website.
- Answer in at most 2–3 short sentences. Be specific and direct.
- If the answer is not in the context, say you couldn't find it on the site.
- Cite the source inline once, like [1]. Do NOT add a list of sources at the
  end - sources are shown to the user automatically.
- Never repeat a sentence, phrase, or URL. Do not invent URLs or facts.
- Use markdown.`;
}

export function answerUser(question: string, context: string): string {
  return `Context from the website:
${context}

Question: ${question}

Write a short, direct answer using only the context above. Cite with [n] once.
Do not list the sources afterwards.`;
}
