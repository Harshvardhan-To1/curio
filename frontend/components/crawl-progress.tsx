'use client';

import { Check, Cog, Download, Globe, Layers } from 'lucide-react';
import { Card, Progress, Spinner } from '@/components/ui';
import { useStore } from '@/lib/store';
import { hostOf } from '@/lib/utils';

function Step({
  icon,
  title,
  detail,
  state,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  state: 'pending' | 'active' | 'done';
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          state === 'done'
            ? 'bg-emerald-500/15 text-emerald-400'
            : state === 'active'
              ? 'bg-brand/10 text-brand'
              : 'bg-elevated text-muted'
        }`}
      >
        {state === 'done' ? (
          <Check className="h-4 w-4" />
        ) : state === 'active' ? (
          <Spinner className="h-4 w-4" />
        ) : (
          icon
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-medium ${
              state === 'pending' ? 'text-muted' : 'text-fg'
            }`}
          >
            {title}
          </span>
          {detail && <span className="text-xs text-muted">{detail}</span>}
        </div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

export function CrawlProgress() {
  const {
    phase,
    seedUrl,
    crawlStatus,
    recentEvents,
    indexProgress,
    modelProgress,
    embedBackend,
    corpusSize,
    largeCorpusWarning,
    degraded,
  } = useStore();

  const crawlState =
    phase === 'crawling' ? 'active' : 'done';
  const indexState =
    phase === 'indexing'
      ? 'active'
      : phase === 'crawling'
        ? 'pending'
        : 'done';
  const modelState =
    phase === 'loading-model'
      ? 'active'
      : phase === 'ready'
        ? 'done'
        : 'pending';

  const indexPct = indexProgress
    ? Math.round((indexProgress.done / Math.max(1, indexProgress.total)) * 100)
    : 0;
  const modelPct = modelProgress ? Math.round(modelProgress.progress * 100) : 0;

  return (
    <Card className="mx-auto w-full max-w-2xl p-6">
      <h2 className="mb-1 text-lg font-semibold">
        Building a knowledge base for{' '}
        <span className="text-brand">{seedUrl ? hostOf(seedUrl) : '…'}</span>
      </h2>
      <p className="mb-6 text-sm text-muted">
        This runs once. Embeddings and the model are cached so you can return
        offline.
      </p>

      <div className="space-y-5">
        <Step
          icon={<Globe className="h-4 w-4" />}
          title="Crawling the site"
          state={crawlState}
          detail={
            crawlStatus
              ? `${crawlStatus.pagesDone}/${crawlStatus.pagesFound} pages · ${crawlStatus.chunkCount} chunks`
              : undefined
          }
        >
          {phase === 'crawling' && recentEvents.length > 0 && (
            <div className="max-h-20 overflow-hidden rounded-lg bg-elevated p-2 font-mono text-[11px] leading-relaxed text-muted">
              {recentEvents.slice(0, 4).map((e, i) => (
                <div key={i} className="truncate">
                  {e}
                </div>
              ))}
            </div>
          )}
        </Step>

        <Step
          icon={<Layers className="h-4 w-4" />}
          title="Embedding content in your browser"
          state={indexState}
          detail={
            indexProgress
              ? `${indexProgress.done}/${indexProgress.total}${
                  embedBackend ? ` · ${embedBackend}` : ''
                }`
              : corpusSize
                ? `${corpusSize} chunks`
                : undefined
          }
        >
          {indexState === 'active' && <Progress value={indexPct} />}
          {largeCorpusWarning && (
            <p className="mt-2 text-xs text-amber-400">
              Large corpus ({corpusSize} chunks) - in-browser search may slow
              down. Consider a smaller crawl or fat-server mode.
            </p>
          )}
        </Step>

        {!degraded && (
          <Step
            icon={<Download className="h-4 w-4" />}
            title="Loading the model"
            state={modelState}
            detail={modelProgress ? `${modelPct}%` : undefined}
          >
            {modelState === 'active' && (
              <>
                <Progress value={modelPct} />
                <p className="mt-1.5 truncate text-xs text-muted">
                  {modelProgress?.text ?? 'Preparing…'}
                </p>
              </>
            )}
          </Step>
        )}

        {degraded && (
          <Step
            icon={<Cog className="h-4 w-4" />}
            title="Retrieval-only mode (no WebGPU)"
            state={phase === 'ready' ? 'done' : 'pending'}
          />
        )}
      </div>
    </Card>
  );
}
