'use client';

import { useEffect } from 'react';
import { History, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { refreshSessions, restoreSession } from '@/lib/orchestrator';
import { deleteCorpus } from '@/lib/idb';
import { hostOf } from '@/lib/utils';

export function SavedSessions() {
  const sessions = useStore((s) => s.sessions);

  useEffect(() => {
    refreshSessions();
  }, []);

  if (!sessions.length) return null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted">
        <History className="h-4 w-4" /> Indexed earlier (works offline)
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sessions.map((s) => (
          <div
            key={s.jobId}
            className="flex items-center justify-between rounded-xl border border-line bg-surface p-3"
          >
            <button
              onClick={() => restoreSession(s.jobId)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-sm font-medium text-fg">
                {hostOf(s.seedUrl)}
              </div>
              <div className="text-xs text-muted">
                {s.chunkCount} chunks
              </div>
            </button>
            <button
              onClick={async () => {
                await deleteCorpus(s.jobId);
                refreshSessions();
              }}
              className="ml-2 rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-red-500"
              aria-label="Delete session"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
