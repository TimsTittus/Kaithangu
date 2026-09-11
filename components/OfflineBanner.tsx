'use client';

import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useCommonStrings } from './CommonStrings';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Offline state shown on every screen (AGENTS.md 7). */
export function OfflineBanner() {
  const online = useOnline();
  const { offline } = useCommonStrings();
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="flex items-center gap-2 bg-amber-200 px-4 py-3 text-base font-medium text-neutral-950"
    >
      <WifiOff aria-hidden className="size-5 shrink-0" />
      {offline}
    </div>
  );
}
