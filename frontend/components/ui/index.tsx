import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'icon';
}) {
  const variants = {
    primary:
      'bg-brand text-brand-fg font-semibold hover:bg-brand-muted disabled:opacity-50 shadow-sm',
    ghost: 'hover:bg-elevated text-muted hover:text-fg',
    outline: 'border border-line bg-surface hover:bg-elevated text-fg',
  };
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    icon: 'h-9 w-9',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
      <div
        className="h-full rounded-full bg-brand transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs font-medium text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}
