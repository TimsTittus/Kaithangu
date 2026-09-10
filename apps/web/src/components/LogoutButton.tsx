'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AudioLabel } from './AudioLabel';
import { secondaryButtonClass } from './ui';

// Caches of public/sw.js that can hold a signed-in user's pages or API data.
const PRIVATE_CACHE_PREFIXES = ['kt-pages-', 'kt-api-'];

async function clearPrivateCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => PRIVATE_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
      .map((name) => caches.delete(name)),
  );
}

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      await clearPrivateCaches();
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={secondaryButtonClass}
        onClick={() => void logout()}
        disabled={busy}
        data-testid="logout"
      >
        <LogOut aria-hidden className="size-5" />
        {label}
      </button>
      <AudioLabel k="common.logout" text={label} />
    </div>
  );
}
