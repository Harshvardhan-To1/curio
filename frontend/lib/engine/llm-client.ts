import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
  type ChatCompletionMessageParam,
} from '@mlc-ai/web-llm';

export interface LlmInitProgress {
  progress: number; // 0..1
  text: string;
}

/**
 * Main-thread handle to the WebLLM engine running in a Web Worker.
 * Exposes streaming + non-streaming chat with an OpenAI-compatible shape.
 */
export class LlmClient {
  private engine: MLCEngineInterface | null = null;
  modelId: string | null = null;

  async load(
    modelId: string,
    onProgress?: (p: LlmInitProgress) => void,
  ): Promise<void> {
    const worker = new Worker(
      new URL('../workers/llm.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.engine = await CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (r: InitProgressReport) =>
        onProgress?.({ progress: r.progress, text: r.text }),
    });
    this.modelId = modelId;
  }

  get ready() {
    return this.engine !== null;
  }

  /** Stream tokens; calls onToken with each delta and returns the full text. */
  async *stream(
    messages: ChatCompletionMessageParam[],
    opts?: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      frequencyPenalty?: number;
      presencePenalty?: number;
    },
  ): AsyncGenerator<string, void, unknown> {
    if (!this.engine) throw new Error('LLM engine not loaded');
    const completion = await this.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: opts?.temperature ?? 0.4,
      max_tokens: opts?.maxTokens ?? 800,
      // Penalties curb the repetition loops small models fall into.
      frequency_penalty: opts?.frequencyPenalty ?? 0.3,
      presence_penalty: opts?.presencePenalty ?? 0.3,
      ...(opts?.jsonMode
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) yield delta;
    }
  }

  /** Non-streaming completion (used for the agent's JSON action steps). */
  async complete(
    messages: ChatCompletionMessageParam[],
    opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
  ): Promise<string> {
    if (!this.engine) throw new Error('LLM engine not loaded');
    const res = await this.engine.chat.completions.create({
      messages,
      stream: false,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? 400,
      ...(opts?.jsonMode
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });
    return res.choices[0]?.message?.content ?? '';
  }

  async unload() {
    await this.engine?.unload();
    this.engine = null;
    this.modelId = null;
  }
}
