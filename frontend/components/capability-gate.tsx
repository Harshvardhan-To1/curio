'use client';

import { AlertTriangle, Cpu, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui';
import type { Capabilities } from '@/lib/capabilities';

/**
 * Shown when WebGPU is missing (spec §4.1). We don't dead-end the user — the
 * app continues in a degraded retrieval-only mode, clearly labeled.
 */
export function CapabilityWarning({
  caps,
  onContinue,
}: {
  caps: Capabilities;
  onContinue: () => void;
}) {
  return (
    <Card className="mx-auto max-w-xl p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            In-browser AI isn’t fully available here
          </h2>
          {!caps.webgpu && (
            <p className="text-sm text-muted">
              Your browser doesn’t expose <strong>WebGPU</strong>, which the
              on-device language model needs. Use a recent{' '}
              <strong>Chrome or Edge (113+)</strong> on desktop for the full
              experience.
            </p>
          )}
          {caps.webgpu && !caps.crossOriginIsolated && (
            <p className="text-sm text-muted">
              The page isn’t{' '}
              <strong>cross-origin isolated</strong> (COOP/COEP headers), so
              threaded WASM can’t run. This is a deployment configuration issue.
            </p>
          )}
          {caps.lowMemory && (
            <p className="text-sm text-muted">
              Your device reports{' '}
              <strong>{caps.deviceMemoryGb} GB</strong> of memory — large models
              may not load. Stick to the smallest model.
            </p>
          )}
          <p className="text-sm text-muted">
            You can still crawl a site and browse the most relevant passages —
            just without a written answer.
          </p>
          <button
            onClick={onContinue}
            className="text-sm font-medium text-brand hover:underline"
          >
            Continue in retrieval-only mode →
          </button>
        </div>
      </div>
    </Card>
  );
}

export function CapabilityBadges({ caps }: { caps: Capabilities }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
          caps.webgpu
            ? 'bg-emerald-500/15 text-emerald-300'
            : 'bg-amber-500/15 text-amber-300'
        }`}
      >
        <Cpu className="h-3.5 w-3.5" />
        {caps.webgpu ? 'WebGPU ready' : 'No WebGPU'}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        On-device generation
      </span>
    </div>
  );
}
