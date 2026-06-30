'use client';

import { Check, Sparkles } from 'lucide-react';
import { MODELS } from '@/lib/models';
import { cn } from '@/lib/utils';

export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODELS.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
              active
                ? 'border-brand bg-brand/10 ring-1 ring-brand'
                : 'border-line bg-surface hover:border-elevated',
            )}
          >
            <div
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                active ? 'border-brand bg-brand text-brand-fg' : 'border-line',
              )}
            >
              {active && <Check className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {m.label}
                {m.recommended && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                    <Sparkles className="h-2.5 w-2.5" /> start here
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">{m.blurb}</div>
              <div className="mt-0.5 text-[11px] text-muted">
                ~{m.sizeGb} GB download · cached after first load
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
