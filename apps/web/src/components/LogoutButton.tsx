'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AudioButton } from './AudioButton';
import { secondaryButtonClass } from './ui';

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
      <AudioButton text={label} />
    </div>
  );
}
