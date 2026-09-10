'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { messageFor, postJson, type Messages } from '@/components/api';
import { AudioButton } from '@/components/AudioButton';
import { errorTextClass, mutedTextClass, primaryButtonClass } from '@/components/ui';

interface Labels {
  phone: string;
  hint: string;
  submit: string;
  sending: string;
}

export function LoginForm({
  next,
  labels,
  messages,
}: {
  next: string;
  labels: Labels;
  messages: Messages;
}) {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(messageFor(messages, 'error.INVALID_PHONE'));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await postJson<{ expiresInSeconds: number }>('/api/v1/auth/otp/request', {
      phone: `+91${digits}`,
    });
    if (!result.ok) {
      setBusy(false);
      setError(messageFor(messages, result.messageKey));
      return;
    }
    const params = new URLSearchParams({ phone: digits });
    if (next) params.set('next', next);
    router.push(`/login/verify?${params.toString()}`);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="phone" className="text-lg font-medium">
          {labels.phone}
        </label>
        <AudioButton text={`${labels.phone}. ${labels.hint}`} />
      </div>
      <div className="flex min-h-14 items-stretch overflow-hidden rounded-xl border-2 border-neutral-600 focus-within:border-emerald-600 dark:border-neutral-400">
        <span className="flex items-center bg-neutral-200 px-3 text-xl font-semibold text-neutral-900">
          +91
        </span>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          value={digits}
          onChange={(event) => setDigits(event.target.value.replace(/\D/g, '').slice(0, 10))}
          aria-describedby="phone-hint"
          aria-invalid={error !== null}
          className="w-full bg-transparent px-3 text-2xl tracking-widest outline-none"
          data-testid="phone-input"
        />
      </div>
      <p id="phone-hint" className={mutedTextClass}>
        {labels.hint}
      </p>
      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={busy}
          data-testid="send-code"
        >
          <Send aria-hidden className="size-5" />
          {busy ? labels.sending : labels.submit}
        </button>
        <AudioButton text={labels.submit} />
      </div>
    </form>
  );
}
