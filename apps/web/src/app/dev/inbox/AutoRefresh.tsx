'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Re-render the server page every `intervalMs` without a full reload. */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
