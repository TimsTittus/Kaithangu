'use client';

import { Briefcase, Check, Landmark, Send, User } from 'lucide-react';
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

interface DemoAccount {
  id: 'customer' | 'worker' | 'admin';
  title: string;
  badge: string;
  phone: string;
  description: string;
  icon: typeof User;
}

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: 'customer',
    title: 'User Requesting Services',
    badge: 'Customer',
    phone: '9000000001',
    description: 'Book certified household & emergency cooperative services',
    icon: User,
  },
  {
    id: 'worker',
    title: 'Gig Worker',
    badge: 'Worker',
    phone: '9000100000',
    description: 'Accept jobs, view welfare allocations & 30-day payouts',
    icon: Briefcase,
  },
  {
    id: 'admin',
    title: 'Corporation & Society',
    badge: 'Corporation',
    phone: '9000000010',
    description: 'Labour Cooperative Society operations, dispatch & reports',
    icon: Landmark,
  },
];

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
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectProfile(account: DemoAccount) {
    setSelectedRole(account.id);
    setDigits(account.phone);
    setError(null);
  }

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
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5" noValidate>
      {/* 3 Account Profiles Switcher Section */}
      <section aria-label="Select Account Profile" className="flex flex-col gap-2.5">
        <span className="text-sm font-semibold tracking-tight text-neutral-800">
          Choose an Account Profile:
        </span>
        <div className="grid grid-cols-1 gap-2.5">
          {DEMO_ACCOUNTS.map((acc) => {
            const Icon = acc.icon;
            const isSelected = selectedRole === acc.id || digits === acc.phone;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => selectProfile(acc)}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                    : 'border-neutral-200 bg-white hover:border-emerald-300 hover:bg-neutral-50/50'
                }`}
              >
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100/70 text-emerald-800'
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base font-bold text-neutral-900">{acc.title}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {acc.badge}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-600">{acc.description}</span>
                  <span className="mt-0.5 text-xs font-mono font-semibold text-emerald-700">
                    +91 {acc.phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                  </span>
                </div>
                {isSelected && (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-3 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Phone Number Input */}
      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="phone" className="text-base font-semibold text-neutral-900">
            {labels.phone}
          </label>
          <AudioButton text={`${labels.phone}. ${labels.hint}`} />
        </div>
        <div className="flex min-h-14 items-stretch overflow-hidden rounded-2xl border-2 border-neutral-300 bg-white shadow-xs focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
          <span className="flex items-center bg-neutral-100 px-3.5 text-lg font-semibold text-neutral-800">
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
            onChange={(event) => {
              const val = event.target.value.replace(/\D/g, '').slice(0, 10);
              setDigits(val);
              setSelectedRole(null);
            }}
            aria-describedby="phone-hint"
            aria-invalid={error !== null}
            placeholder="9000000001"
            className="w-full bg-transparent px-3 text-xl tracking-widest text-neutral-900 outline-none"
            data-testid="phone-input"
          />
        </div>
        <p id="phone-hint" className={mutedTextClass}>
          {labels.hint}
        </p>
      </div>

      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
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
