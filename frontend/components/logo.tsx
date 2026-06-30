import { cn } from '@/lib/utils';

/** Curio wordmark + mark. The mark is a stylized chat/grid glyph. */
export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v7C20 14.88 18.88 16 17.5 16H9l-4 4v-3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10" r="1.1" fill="currentColor" />
          <circle cx="12.5" cy="10" r="1.1" fill="currentColor" />
          <circle cx="16" cy="10" r="1.1" fill="currentColor" />
        </svg>
      </span>
      {showWord && (
        <span className="text-lg font-bold tracking-tight">
          Cur<span className="text-brand">io</span>
        </span>
      )}
    </span>
  );
}
