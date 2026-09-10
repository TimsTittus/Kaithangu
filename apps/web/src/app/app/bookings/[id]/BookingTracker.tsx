'use client';

import type { BookingStatus, BookingView } from '@kaithangu/core';
import {
  BadgeCheck,
  CircleCheck,
  CircleDot,
  Circle,
  Home,
  LoaderCircle,
  Star,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fill, getJson, messageFor, postJson, type Messages } from '@/components/api';
import { AudioLabel } from '@/components/AudioLabel';
import { useCommonStrings } from '@/components/CommonStrings';
import { formatPaise } from '@/components/money';
import {
  cardClass,
  errorTextClass,
  mutedTextClass,
  pageClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/ui';

const POLL_MS = 5_000;
const TERMINAL: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'completed',
  'cancelled',
  'resolved',
]);
const HAPPY_PATH: readonly BookingStatus[] = [
  'requested',
  'matching',
  'offered',
  'accepted',
  'en_route',
  'in_progress',
  'completed',
];
const TIME_ZONE = 'Asia/Kolkata';

interface Props {
  initial: BookingView;
  tradeLabel: string;
  strings: Record<string, string>;
  errors: Messages;
}

type Step = { status: BookingStatus; at: string | null; state: 'done' | 'current' | 'pending' };

/** The happy path with times, or (off the path) what actually happened. */
function timeline(view: BookingView): Step[] {
  const reachedAt = new Map<BookingStatus, string>();
  for (const event of view.events) reachedAt.set(event.toStatus, event.at);
  const index = HAPPY_PATH.indexOf(view.status);
  if (index >= 0) {
    return HAPPY_PATH.map((status, i) => ({
      status,
      at: reachedAt.get(status) ?? null,
      state:
        i < index || view.status === 'completed' ? 'done' : i === index ? 'current' : 'pending',
    }));
  }
  const steps: Step[] = view.events.map((event) => ({
    status: event.toStatus,
    at: event.at,
    state: 'done',
  }));
  const last = steps.at(-1);
  if (last?.status === view.status) last.state = 'current';
  return steps;
}

export function BookingTracker({ initial, tradeLabel, strings, errors }: Props) {
  const { locale } = useCommonStrings();
  const s = (key: string) => strings[key] ?? key;
  const [view, setView] = useState(initial);
  const [cancelStage, setCancelStage] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (TERMINAL.has(view.status)) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void getJson<BookingView>(`/api/v1/bookings/${view.id}`).then((result) => {
        if (result.ok) setView(result.data);
      });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [view.id, view.status]);

  const dateTime = new Intl.DateTimeFormat(`${locale}-IN`, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  async function cancel() {
    setCancelStage('busy');
    setError(null);
    const result = await postJson<BookingView>(`/api/v1/bookings/${view.id}/cancel`, {});
    if (result.ok) {
      setView(result.data);
      setCancelStage('idle');
      return;
    }
    setCancelStage('confirm');
    setError(messageFor(errors, result.messageKey));
  }

  const statusLabel = s(`status.${view.status}`);
  const title = s('booking.tracking_title');

  return (
    <main className={pageClass}>
      <header className="flex flex-col gap-2 rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h1>
          <AudioLabel k="booking.tracking_title" text={title} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{tradeLabel}</span>
          {view.urgency === 'emergency' && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
              {s('booking.emergency_badge')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <p
            className="text-lg font-bold text-emerald-700 dark:text-emerald-400"
            data-testid="booking-status"
            data-status={view.status}
          >
            {statusLabel}
          </p>
        </div>
        {!TERMINAL.has(view.status) && <p className={mutedTextClass}>{s('booking.live_hint')}</p>}
      </header>

      {view.otps !== null && (
        <section className={cardClass} aria-live="polite">
          {view.otps.start !== null && (
            <OtpBlock
              label={s('booking.start_otp')}
              code={view.otps.start}
              audioKey="booking.start_otp"
              testId="start-otp"
            />
          )}
          {view.otps.complete !== null && (
            <OtpBlock
              label={s('booking.complete_otp')}
              code={view.otps.complete}
              audioKey="booking.complete_otp"
              testId="complete-otp"
            />
          )}
          <p className={mutedTextClass}>{s('booking.otp_hint')}</p>
        </section>
      )}

      {view.worker !== null && (
        <section className={cardClass} data-testid="worker-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{s('booking.worker_title')}</h2>
            <AudioLabel k="booking.worker_title" text={s('booking.worker_title')} />
          </div>
          <p className="text-xl font-semibold break-words">{view.worker.name}</p>
          <p className="text-base">{tradeLabel}</p>
          <p className="flex items-center gap-2 text-base font-medium text-emerald-800 dark:text-emerald-300">
            <BadgeCheck aria-hidden className="size-5 shrink-0" />
            {fill(s('booking.verified_by'), { society: view.worker.societyName })}
          </p>
          <p className="flex items-center gap-2 text-base">
            <Star aria-hidden className="size-5 shrink-0" />
            {view.worker.rating === null
              ? s('booking.new_worker')
              : fill(s('booking.rating'), {
                  rating: view.worker.rating,
                  count: view.worker.ratingCount,
                })}
          </p>
          <div>
            <p className="text-base font-medium">{s('booking.verification_code')}</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="check-code">
              {view.worker.checkCode}
            </p>
            <p className={mutedTextClass}>{s('booking.verification_hint')}</p>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{s('booking.timeline')}</h2>
        <ol className="flex flex-col" data-testid="timeline">
          {timeline(view).map((step, i) => (
            <li key={`${step.status}-${i}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                {step.state === 'done' ? (
                  <CircleCheck aria-hidden className="size-6 shrink-0 text-emerald-700" />
                ) : step.state === 'current' ? (
                  <CircleDot aria-hidden className="size-6 shrink-0 text-emerald-700" />
                ) : (
                  <Circle aria-hidden className="size-6 shrink-0 text-neutral-400" />
                )}
                <span className="w-0.5 flex-1 bg-neutral-300" />
              </div>
              <div className="pb-4">
                <p
                  className={
                    step.state === 'pending'
                      ? 'text-base text-neutral-600 dark:text-neutral-400'
                      : 'text-base font-medium'
                  }
                >
                  {s(`status.${step.status}`)}
                </p>
                {step.at !== null && (
                  <time
                    dateTime={step.at}
                    suppressHydrationWarning
                    className="text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    {dateTime.format(new Date(step.at))}
                  </time>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">{s('booking.details')}</h2>
        <dl className="flex flex-col gap-2 text-base">
          <Detail term={s('booking.problem')} value={view.problemText} />
          <Detail term={s('booking.address')} value={`${view.addressText} · ${view.pincode}`} />
          <Detail
            term={s('booking.when')}
            value={
              view.scheduledFor === null
                ? s('booking.asap')
                : dateTime.format(new Date(view.scheduledFor))
            }
          />
          <Detail term={s('booking.total')} value={formatPaise(view.price.totalPaise, locale)} />
        </dl>
      </section>

      {error !== null && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}

      <nav className="mt-auto flex flex-col gap-3">
        {view.canCancel && cancelStage === 'idle' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCancelStage('confirm')}
              className={secondaryButtonClass}
              data-testid="cancel"
            >
              <X aria-hidden className="size-5" />
              {s('booking.cancel')}
            </button>
            <AudioLabel k="booking.cancel" text={s('booking.cancel')} />
          </div>
        )}
        {view.canCancel && cancelStage !== 'idle' && (
          <div className={cardClass} role="alertdialog" aria-label={s('booking.cancel_confirm')}>
            <p className="text-lg font-medium">{s('booking.cancel_confirm')}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={cancelStage === 'busy'}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-lg font-semibold text-white disabled:opacity-60"
                data-testid="cancel-yes"
              >
                {cancelStage === 'busy' ? (
                  <LoaderCircle aria-hidden className="size-5 animate-spin" />
                ) : (
                  <X aria-hidden className="size-5" />
                )}
                {cancelStage === 'busy' ? s('booking.cancelling') : s('booking.cancel_yes')}
              </button>
              <AudioLabel k="booking.cancel_yes" text={s('booking.cancel_yes')} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCancelStage('idle')}
                disabled={cancelStage === 'busy'}
                className={secondaryButtonClass}
                data-testid="cancel-no"
              >
                {s('booking.cancel_no')}
              </button>
              <AudioLabel k="booking.cancel_no" text={s('booking.cancel_no')} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Link href="/app" className={view.canCancel ? secondaryButtonClass : primaryButtonClass}>
            <Home aria-hidden className="size-5" />
            {s('booking.home')}
          </Link>
          <AudioLabel k="booking.home" text={s('booking.home')} />
        </div>
      </nav>
    </main>
  );
}

function OtpBlock({
  label,
  code,
  audioKey,
  testId,
}: {
  label: string;
  code: string;
  audioKey: string;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-base font-medium">{label}</p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em]" data-testid={testId}>
          {code}
        </p>
      </div>
      <AudioLabel k={audioKey} text={label} />
    </div>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="font-medium">{term}</dt>
      <dd className="break-words text-neutral-800 dark:text-neutral-200">{value}</dd>
    </div>
  );
}
