/// <reference lib="webworker" />
/**
 * WebLLM generation worker. The heavy WebGPU inference runs here so it never
 * blocks the UI thread (spec §4.2). We just forward messages to WebLLM's
 * built-in worker handler, which implements the OpenAI-compatible engine.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};

export {};
