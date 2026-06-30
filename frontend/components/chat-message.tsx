'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  ChevronDown,
  Copy,
  CheckCheck,
  ExternalLink,
  Wrench,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn, hostOf } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';

const TOOL_LABEL: Record<string, string> = {
  retrieve: 'Searching the site',
  keyword_search: 'Looking up an exact term',
  list_pages: 'Scanning the page list',
  get_page: 'Reading a page',
  fetch_more: 'Crawling another page',
};

/** Shown in the assistant bubble while the agent works but no tokens exist yet. */
function WorkingIndicator({ message }: { message: ChatMessage }) {
  const last = message.trace?.[message.trace.length - 1];
  const label = last
    ? `${TOOL_LABEL[last.tool] ?? last.tool}… composing answer`
    : 'Thinking…';
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={cn(
        'flex animate-fade-in',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'group max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-brand text-brand-fg'
            : 'border border-line bg-surface text-fg',
        )}
      >
        {/* Tool-use trace (assistant only) */}
        {!isUser && message.trace && message.trace.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setShowTrace((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            >
              <Wrench className="h-3 w-3" />
              {message.trace.length} tool step
              {message.trace.length > 1 ? 's' : ''}
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform',
                  showTrace && 'rotate-180',
                )}
              />
            </button>
            {showTrace && (
              <ol className="mt-2 space-y-1 rounded-lg bg-elevated p-2 text-[11px] text-muted">
                {message.trace.map((t) => (
                  <li key={t.step}>
                    <span className="font-semibold text-brand">{t.tool}</span>
                    <span className="text-muted">
                      ({JSON.stringify(t.args)})
                    </span>
                    <div className="truncate text-muted">
                      → {t.observation.split('\n')[0]}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Body */}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : message.content ? (
          <div className="prose prose-sm prose-neutral max-w-none prose-p:my-1.5 prose-headings:mt-2 prose-pre:bg-neutral-900 prose-pre:text-neutral-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
            >
              {message.content + (message.streaming ? ' ▍' : '')}
            </ReactMarkdown>
          </div>
        ) : message.streaming ? (
          <WorkingIndicator message={message} />
        ) : null}

        {message.error && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-3.5 w-3.5" /> {message.error}
          </div>
        )}

        {message.fallback && (
          <div className="mt-1 text-[11px] italic text-amber-400">
            (answered with plain retrieval - the agent couldn’t use tools)
          </div>
        )}

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-line pt-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Sources
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c, i) => (
                <a
                  key={i}
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={c.pageTitle}
                  className="inline-flex max-w-[200px] items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted hover:bg-line hover:text-fg"
                >
                  <span className="font-semibold text-brand">[{i + 1}]</span>
                  <span className="truncate">{hostOf(c.sourceUrl)}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Copy (assistant, settled) */}
        {!isUser && !message.streaming && message.content && (
          <button
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
          >
            {copied ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
