'use client';

import { useState } from 'react';
import { Globe, Settings2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { ModelPicker } from './model-picker';
import { useStore } from '@/lib/store';
import { startSession } from '@/lib/orchestrator';
import type { CrawlOptions } from '@/lib/api';

export function UrlForm() {
  const { modelId, setModel, degraded } = useStore();
  const [url, setUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxPages, setMaxPages] = useState(100);
  const [maxDepth, setMaxDepth] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const options: CrawlOptions = { maxPages, maxDepth };
    setSubmitting(true);
    await startSession(normalized, options);
  };

  return (
    <Card className="mx-auto w-full max-w-2xl p-6">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg">
            Website URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com"
                autoFocus
                inputMode="url"
                className="h-11 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <Button type="submit" disabled={submitting || !url.trim()} className="h-11">
              {submitting ? 'Starting…' : 'Crawl & Chat'}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            We crawl the site server-side (robots-respecting). Generation runs
            entirely in your browser — nothing you ask leaves your device.
          </p>
        </div>

        {!degraded && (
          <div>
            <label className="mb-2 block text-sm font-medium text-fg">
              In-browser model
            </label>
            <ModelPicker value={modelId} onChange={setModel} disabled={submitting} />
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
          >
            <Settings2 className="h-4 w-4" />
            Advanced crawl options
          </button>
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="mb-1 block text-muted">Max pages</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-line px-3 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Max depth</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-line px-3 text-sm"
                />
              </label>
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}
