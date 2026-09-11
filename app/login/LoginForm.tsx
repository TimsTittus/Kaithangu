'use client';

import { Briefcase, Landmark, Send, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { messageFor, postJson, type Messages } from '@/components/api';
import { AudioButton } from '@/components/AudioButton';
import { errorTextClass, mutedTextClass, primaryButtonClass } from '@/components/ui';
import type { Role } from '@/lib/core/context';

interface Labels {
  phone: string;
  hint: string;
  submit: string;
  sending: string;
}

interface AccountProfile {
  id: Role;
  badge: string;
  description: string;
  icon: typeof User;
}

const ACCOUNT_PROFILES: readonly AccountProfile[] = [
  {
    id: 'user',
    badge: 'User',
    description: 'Book certified household & emergency cooperative services',
    icon: User,
  },
  {
    id: 'worker',
    badge: 'Worker',
    description: 'Accept jobs, view welfare allocations & 30-day payouts',
    icon: Briefcase,
  },
  {
    id: 'corporate',
    badge: 'Corporate',
    description: 'Welfare fund, enrolments, worker roster & operations',
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
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProfile = ACCOUNT_PROFILES.find((profile) => profile.id === selectedRole) ?? null;

  function selectProfile(profile: AccountProfile) {
    setSelectedRole(profile.id);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedRole === null) {
      setError('Choose an account profile first.');
      return;
    }
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
    const params = new URLSearchParams({ phone: digits, role: selectedRole });
    if (next) params.set('next', next);
    router.push(`/login/verify?${params.toString()}`);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex min-h-0 flex-col gap-5"
      noValidate
    >
      <section aria-label="Select Account Profile" className="flex shrink-0 flex-col gap-2">
        <span className="text-sm font-semibold tracking-tight text-neutral-800">
          Choose an Account Profile:
        </span>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_PROFILES.map((profile) => {
            const Icon = profile.icon;
            const isSelected = selectedRole === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => selectProfile(profile)}
                className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1.5 py-2 text-center transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                    : 'border-neutral-200 bg-white hover:border-emerald-300 hover:bg-neutral-50/50'
                }`}
              >
                <div
                  className={`flex size-9 items-center justify-center rounded-xl ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100/70 text-emerald-800'
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <span className="w-full truncate text-xs font-bold text-neutral-900">
                  {profile.badge}
                </span>
              </button>
            );
          })}
        </div>
        {selectedProfile && (
          <p className="text-xs leading-snug text-neutral-600">{selectedProfile.description}</p>
        )}
      </section>

      <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 pt-3">
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
              setDigits(event.target.value.replace(/\D/g, '').slice(0, 10));
            }}
            aria-describedby="phone-hint"
            aria-invalid={error !== null}
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

      <div className="flex shrink-0 items-center gap-3 pt-1">
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
