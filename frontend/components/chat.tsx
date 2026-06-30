'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { MessageBubble } from './chat-message';
import { useStore } from '@/lib/store';
import { sendMessage } from '@/lib/orchestrator';
import { hostOf } from '@/lib/utils';
import { modelById } from '@/lib/models';

const SUGGESTIONS = [
  'What is this site about?',
  'Summarize the main sections.',
  'How do I get in touch?',
];

export function Chat({ onReset }: { onReset: () => void }) {
  const { messages, thinking, seedUrl, modelId, degraded, corpusSize } =
    useStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput('');
    await sendMessage(t);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {seedUrl ? hostOf(seedUrl) : 'Curio'}
          </div>
          <div className="text-xs text-muted">
            {corpusSize} chunks ·{' '}
            {degraded
              ? 'retrieval-only'
              : `${modelById(modelId)?.label ?? modelId} · on-device`}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> New site
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                disabled={thinking}
                className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder={
              thinking ? 'Thinking…' : `Ask about ${seedUrl ? hostOf(seedUrl) : 'this site'}…`
            }
            disabled={thinking}
            className="max-h-32 flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-elevated"
          />
          <Button
            type="submit"
            size="icon"
            disabled={thinking || !input.trim()}
            className="h-11 w-11 rounded-xl"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-muted">
          {degraded
            ? 'Showing relevant passages - enable WebGPU for written answers.'
            : 'Answers are generated on your device and grounded in the crawled site.'}
        </p>
      </div>
    </div>
  );
}
