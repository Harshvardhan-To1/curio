'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { detectCapabilities } from '@/lib/capabilities';
import { Button, Card, Spinner } from '@/components/ui';
import { CrawlProgress } from '@/components/crawl-progress';
import { Chat } from '@/components/chat';
import { Landing } from '@/components/landing';

export default function Home() {
  const { phase, error, capabilities, set, reset } = useStore();

  useEffect(() => {
    let active = true;
    detectCapabilities().then((caps) => {
      if (!active) return;
      const usable = caps.webgpu && caps.crossOriginIsolated;
      set({ capabilities: caps, degraded: !usable, phase: 'idle' });
    });
    return () => {
      active = false;
    };
  }, [set]);

  if (phase === 'gate' || !capabilities) {
    return (
      <Center>
        <div className="flex items-center gap-2 text-muted">
          <Spinner className="h-5 w-5" /> Checking your browser…
        </div>
      </Center>
    );
  }

  if (phase === 'ready') {
    return (
      <main className="h-screen bg-surface">
        <Chat onReset={reset} />
      </main>
    );
  }

  if (phase === 'crawling' || phase === 'indexing' || phase === 'loading-model') {
    return (
      <Center>
        <CrawlProgress />
      </Center>
    );
  }

  if (phase === 'error') {
    return (
      <Center>
        <Card className="mx-auto max-w-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <h2 className="mb-1 text-lg font-semibold">Something went wrong</h2>
          <p className="mb-4 text-sm text-muted">{error}</p>
          <Button onClick={reset}>Try another site</Button>
        </Card>
      </Center>
    );
  }

  // idle → the full product landing page (hero contains the URL form CTA)
  return (
    <main id="top">
      <Landing />
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full">{children}</div>
    </main>
  );
}
