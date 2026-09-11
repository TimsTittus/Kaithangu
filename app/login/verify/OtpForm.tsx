'use client';

import type { Role } from '@/lib/core/context';
import { Check, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { messageFor, postJson, type Messages } from '@/components/api';
import { AudioButton } from '@/components/AudioButton';
import {
  errorTextClass,
  mutedTextClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/ui';

const LENGTH = 6;
const EMPTY = Array.from({ length: LENGTH }, () => '');

interface Labels {
  hint: string;
  digits: string[];
  verify: string;
  verifying: string;
  resend: string;
  resent: string;
  changeNumber: string;
}

interface VerifyResponse {
  redirectTo: string;
}

export function OtpForm({
  phone,
  next,
  role,
  labels,
  messages,
}: {
  /** 10-digit national number. */
  phone: string;
  next: string;
  role?: Role;
  labels: Labels;
  messages: Messages;
}) {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (index: number) =>
    inputs.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();

  async function verify(code: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await postJson<VerifyResponse>('/api/v1/auth/otp/verify', {
      phone: `+91${phone}`,
      code,
      ...(next ? { next } : {}),
      ...(role ? { role } : {}),
    });
    if (result.ok) {
      // Full navigation so the new session cookie and locale apply everywhere.
      window.location.assign(result.data.redirectTo);
      return;
    }
    setBusy(false);
    setError(messageFor(messages, result.messageKey));
    setDigits(EMPTY);
    focus(0);
  }

  /** Put `text` into the boxes starting at `start` (typing, paste or SMS autofill). */
  function fill(start: number, text: string) {
    const incoming = text
      .replace(/\D/g, '')
      .slice(0, LENGTH - start)
      .split('');
    if (incoming.length === 0) return;
    const nextDigits = [...digits];
    incoming.forEach((digit, offset) => {
      nextDigits[start + offset] = digit;
    });
    setDigits(nextDigits);
    const code = nextDigits.join('');
    if (code.length === LENGTH && !nextDigits.includes('')) {
      void verify(code);
    } else {
      focus(start + incoming.length);
    }
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index - 1] = '';
      setDigits(nextDigits);
      focus(index - 1);
    } else if (event.key === 'ArrowLeft') {
      focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      focus(index + 1);
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    fill(index, event.clipboardData.getData('text'));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = digits.join('');
    if (code.length === LENGTH) void verify(code);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/v1/auth/otp/request', { phone: `+91${phone}` });
    setBusy(false);
    if (result.ok) {
      setNotice(labels.resent);
      setDigits(EMPTY);
      focus(0);
    } else {
      setError(messageFor(messages, result.messageKey));
    }
  }

  const changeHref = next ? `/login?${new URLSearchParams({ next }).toString()}` : '/login';

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-3">
        <p className={mutedTextClass}>{labels.hint}</p>
        <AudioButton text={labels.hint} />
      </div>
      <div className="flex justify-between gap-2" dir="ltr">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            // One digit per box, but the first box accepts a whole autofilled code.
            maxLength={index === 0 ? LENGTH : 1}
            value={digit}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '');
              if (value === '') {
                const nextDigits = [...digits];
                nextDigits[index] = '';
                setDigits(nextDigits);
              } else {
                fill(index, value.length > 1 && digit !== '' ? value.replace(digit, '') : value);
              }
            }}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
            onFocus={(event) => event.target.select()}
            disabled={busy}
            aria-label={labels.digits[index]}
            className="h-14 w-full min-w-0 rounded-xl border-2 border-neutral-600 bg-transparent text-center text-2xl font-semibold focus:border-emerald-600 focus:outline-none dark:border-neutral-400"
            data-testid={`otp-digit-${index + 1}`}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className={errorTextClass} data-testid="otp-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={mutedTextClass}>
          {notice}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={busy || digits.includes('')}
          data-testid="verify-code"
        >
          <Check aria-hidden className="size-5" />
          {busy ? labels.verifying : labels.verify}
        </button>
        <AudioButton text={labels.verify} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void resend()}
          disabled={busy}
        >
          <RotateCw aria-hidden className="size-5" />
          {labels.resend}
        </button>
        <AudioButton text={labels.resend} />
      </div>
      <Link href={changeHref} className="min-h-12 py-3 text-center text-lg underline">
        {labels.changeNumber}
      </Link>
    </form>
  );
}
