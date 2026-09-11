'use client';

import { Check, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '@/trpc/client';

export interface VerifyWorkerButtonProps {
  workerId: string;
  status: 'pending' | 'verified' | 'suspended';
  labels: {
    verify: string;
    revoke: string;
    verified: string;
    pending: string;
    suspended: string;
    confirmVerify: string;
    confirmRevoke: string;
  };
}

export function VerifyWorkerButton({ workerId, status: initialStatus, labels }: VerifyWorkerButtonProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = trpc.corporate.verifyWorker.useMutation();
  const revokeMutation = trpc.corporate.revokeWorker.useMutation();

  async function handleVerify() {
    if (!window.confirm(labels.confirmVerify)) return;
    setBusy(true);
    setError(null);
    try {
      await verifyMutation.mutateAsync({ workerId });
      setCurrentStatus('verified');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!window.confirm(labels.confirmRevoke)) return;
    setBusy(true);
    setError(null);
    try {
      await revokeMutation.mutateAsync({ workerId });
      setCurrentStatus('pending');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revocation failed');
    } finally {
      setBusy(false);
    }
  }

  if (currentStatus === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
        {labels.suspended}
      </span>
    );
  }

  if (currentStatus === 'verified') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          {labels.verified}
        </span>
        <button
          type="button"
          onClick={() => void handleRevoke()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-rose-600 disabled:opacity-50 transition-colors p-1"
          title={labels.revoke}
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RotateCcw className="size-3" />
          )}
          <span className="underline">{labels.revoke}</span>
        </button>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    );
  }

  // pending status
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleVerify()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 disabled:opacity-60 transition-all"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="size-3.5" />
        )}
        <span>{labels.verify}</span>
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
