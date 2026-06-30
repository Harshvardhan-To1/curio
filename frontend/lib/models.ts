/**
 * The curated in-browser model menu (spec §4.2). IDs must exist in
 * @mlc-ai/web-llm's prebuiltAppConfig. `sizeGb` is the approximate download.
 */
export interface ModelOption {
  id: string;
  label: string;
  sizeGb: number;
  blurb: string;
  recommended?: boolean;
}

export const MODELS: ModelOption[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    sizeGb: 0.9,
    blurb: 'Fastest & lightest — best for a first run.',
    recommended: true,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B',
    sizeGb: 2.3,
    blurb: 'Noticeably better answers; needs more VRAM.',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 mini',
    sizeGb: 2.5,
    blurb: 'Strong reasoning for its size.',
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 3B',
    sizeGb: 2.0,
    blurb: 'Great multilingual & structured output.',
  },
];

export function modelById(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}
