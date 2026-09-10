'use client';

import type { PricingLineKey, QuoteView, SavedAddress, TradeCode } from '@kaithangu/core';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  LoaderCircle,
  LocateFixed,
  MapPin,
  RotateCcw,
  Siren,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { fill, messageFor, newIdempotencyKey, postJson, type Messages } from '@/components/api';
import { AudioButton } from '@/components/AudioButton';
import { AudioLabel } from '@/components/AudioLabel';
import { useCommonStrings } from '@/components/CommonStrings';
import { formatPaise } from '@/components/money';
import {
  cardClass,
  choiceClass,
  choiceIdleClass,
  choiceSelectedClass,
  errorTextClass,
  inputClass,
  mutedTextClass,
  pageClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/ui';
import type { SlotDay } from './keys';
import { MicButton } from './MicButton';

// MapLibre is large: load it only when the location step shows a map.
const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-xl bg-neutral-200" />,
});

type When = 'now' | 'emergency' | 'slot';
type Coords = { lat: number; lng: number };

const STEPS = ['problem', 'location', 'when', 'quote'] as const;
const STEP_TITLE_KEYS = [
  'booking.problem_title',
  'booking.location_title',
  'booking.when_title',
  'booking.quote_title',
] as const;
const PINCODE = /^[1-9][0-9]{5}$/;
const MIN_TEXT = 3;

interface Props {
  tradeCode: TradeCode;
  tradeLabel: string;
  initialWhen: When;
  chips: { id: string; label: string }[];
  slotDays: SlotDay[];
  savedAddresses: SavedAddress[];
  strings: Record<string, string>;
  errors: Messages;
}

export function BookingWizard(props: Props) {
  const { tradeCode, tradeLabel, chips, slotDays, savedAddresses, strings, errors } = props;
  const { locale } = useCommonStrings();
  const router = useRouter();
  const s = (key: string) => strings[key] ?? key;

  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<'idle' | 'locating' | 'found' | 'failed'>('idle');
  const [when, setWhen] = useState<When>(props.initialWhen);
  const [slotDay, setSlotDay] = useState(slotDays[0]?.key ?? '');
  const [slot, setSlot] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotency = useRef<{ body: string; key: string } | null>(null);

  const stepName = STEPS[step] ?? 'problem';
  const stepTitle = s(STEP_TITLE_KEYS[step] ?? 'booking.problem_title');

  function locationBody() {
    return {
      ...(coords === null ? {} : { lat: coords.lat, lng: coords.lng }),
      ...(pincode === '' ? {} : { pincode }),
    };
  }

  function quoteBody() {
    return {
      tradeCode,
      urgency: when === 'emergency' ? 'emergency' : 'normal',
      ...locationBody(),
    };
  }

  async function loadQuote(): Promise<boolean> {
    setQuoteLoading(true);
    setQuote(null);
    setError(null);
    const result = await postJson<QuoteView>('/api/v1/quotes', quoteBody());
    setQuoteLoading(false);
    if (result.ok) {
      setQuote(result.data);
      return true;
    }
    setError(messageFor(errors, result.messageKey));
    return false;
  }

  function validate(): string | null {
    if (stepName === 'problem' && problem.trim().length < MIN_TEXT) {
      return s('booking.problem_required');
    }
    if (stepName === 'location') {
      if (pincode !== '' && !PINCODE.test(pincode)) return s('booking.pincode_invalid');
      if (coords === null && pincode === '') return s('booking.location_required');
      if (landmark.trim().length < MIN_TEXT) return s('booking.landmark_required');
    }
    if (stepName === 'when' && when === 'slot' && slot === null) return s('booking.slot_required');
    return null;
  }

  function next() {
    const problemMessage = validate();
    setError(problemMessage);
    if (problemMessage !== null) return;
    const nextStep = step + 1;
    setStep(nextStep);
    if (STEPS[nextStep] === 'quote') void loadQuote();
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setGeo('failed');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeo('found');
      },
      () => setGeo('failed'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  function pickSaved(address: SavedAddress) {
    setPincode(address.pincode);
    setLandmark(address.addressText);
    setCoords({ lat: address.location.lat, lng: address.location.lng });
    setGeo('found');
  }

  function addChip(label: string) {
    setProblem((current) => {
      const text = current.trim();
      if (text.includes(label)) return current;
      return text === '' ? label : `${text}, ${label}`;
    });
  }

  async function confirm() {
    if (quote === null) return;
    const body = {
      ...quoteBody(),
      problemText: problem.trim(),
      addressText: landmark.trim(),
      ...(when === 'slot' && slot !== null ? { scheduledFor: slot } : {}),
      expectedTotalPaise: quote.totalPaise,
    };
    const serialized = JSON.stringify(body);
    // A retry of the same booking reuses its key, so it can never book twice.
    if (idempotency.current?.body !== serialized) {
      idempotency.current = { body: serialized, key: newIdempotencyKey() };
    }
    setSubmitting(true);
    setError(null);
    const result = await postJson<{ id: string }>('/api/v1/bookings', body, {
      'idempotency-key': idempotency.current.key,
    });
    if (result.ok) {
      router.replace(`/app/bookings/${result.data.id}`);
      return;
    }
    setSubmitting(false);
    if (result.messageKey === 'error.PRICE_CHANGED') {
      await loadQuote();
    }
    setError(messageFor(errors, result.messageKey));
  }

  const lines: { key: PricingLineKey; amount: number }[] =
    quote === null
      ? []
      : quote.breakdownKeys.map((key) => ({
          key,
          amount:
            key === 'pricing.wage'
              ? quote.wagePaise - quote.surchargePaise
              : key === 'pricing.emergency_surcharge'
                ? quote.surchargePaise
                : key === 'pricing.welfare'
                  ? quote.welfarePaise
                  : key === 'pricing.platform_fee'
                    ? quote.platformFeePaise
                    : quote.gstPaise,
        }));
  const total = quote === null ? '' : formatPaise(quote.totalPaise, locale);
  const selectedDay = slotDays.find((day) => day.key === slotDay);

  return (
    <main className={pageClass}>
      <header className="flex flex-col gap-2">
        {/* Modern Segmented Progress Bar */}
        <div className="flex w-full items-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            />
          ))}
        </div>

        <p className={mutedTextClass}>{fill(s('booking.title'), { trade: tradeLabel })}</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white" data-testid="step-title">
            {stepTitle}
          </h1>
          <AudioLabel k={STEP_TITLE_KEYS[step] ?? 'booking.problem_title'} text={stepTitle} />
        </div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {fill(s('booking.step'), { n: step + 1, total: STEPS.length })}
        </p>
      </header>

      {stepName === 'problem' && (
        <section className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-lg font-medium">
            {s('booking.problem_label')}
            <textarea
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              placeholder={s('booking.problem_placeholder')}
              maxLength={1000}
              rows={4}
              className={`${inputClass} py-2`}
              data-testid="problem-input"
            />
          </label>
          <MicButton
            onTranscript={(text) =>
              setProblem((current) => (current.trim() === '' ? text : `${current.trim()} ${text}`))
            }
            strings={{
              start: s('booking.mic_start'),
              stop: s('booking.mic_stop'),
              listening: s('booking.mic_listening'),
              processing: s('booking.mic_processing'),
              failed: s('booking.mic_failed'),
              denied: s('booking.mic_denied'),
            }}
            errors={errors}
          />
          {chips.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{s('booking.quick_picks')}</h2>
                <AudioLabel k="booking.quick_picks" text={s('booking.quick_picks')} />
              </div>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => addChip(chip.label)}
                    className="min-h-12 rounded-full border-2 border-emerald-700 px-4 py-2 text-base font-medium"
                    data-testid={`chip-${chip.id}`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {stepName === 'location' && (
        <section className="flex flex-col gap-4">
          <Row audio={<AudioLabel k="booking.use_location" text={s('booking.use_location')} />}>
            <button
              type="button"
              onClick={locateMe}
              disabled={geo === 'locating'}
              className={secondaryButtonClass}
              data-testid="use-location"
            >
              {geo === 'locating' ? (
                <LoaderCircle aria-hidden className="size-5 animate-spin" />
              ) : (
                <LocateFixed aria-hidden className="size-5" />
              )}
              {geo === 'locating' ? s('booking.locating') : s('booking.use_location')}
            </button>
          </Row>
          {geo === 'failed' && <p className={errorTextClass}>{s('booking.location_failed')}</p>}
          {geo === 'found' && <p className={mutedTextClass}>{s('booking.location_found')}</p>}
          {coords !== null && (
            <MapPicker
              lat={coords.lat}
              lng={coords.lng}
              onMove={setCoords}
              label={s('booking.map_label')}
              unavailable={s('booking.map_unavailable')}
            />
          )}

          {savedAddresses.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{s('booking.saved_addresses')}</h2>
                <AudioLabel k="booking.saved_addresses" text={s('booking.saved_addresses')} />
              </div>
              {savedAddresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => pickSaved(address)}
                  className={`${choiceClass} ${choiceIdleClass}`}
                >
                  <MapPin aria-hidden className="size-5 shrink-0" />
                  <span className="break-words">
                    {address.addressText} · {address.pincode}
                  </span>
                </button>
              ))}
            </div>
          )}

          <label className="flex flex-col gap-2 text-lg font-medium">
            <span className="flex items-center justify-between gap-3">
              {s('booking.pincode_label')}
              <AudioLabel k="booking.pincode_label" text={s('booking.pincode_label')} />
            </span>
            <input
              value={pincode}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder={s('booking.pincode_hint')}
              className={inputClass}
              data-testid="pincode-input"
            />
          </label>
          <label className="flex flex-col gap-2 text-lg font-medium">
            <span className="flex items-center justify-between gap-3">
              {s('booking.landmark_label')}
              <AudioLabel k="booking.landmark_label" text={s('booking.landmark_label')} />
            </span>
            <input
              value={landmark}
              onChange={(event) => setLandmark(event.target.value)}
              maxLength={300}
              autoComplete="street-address"
              className={inputClass}
              data-testid="landmark-input"
            />
          </label>
        </section>
      )}

      {stepName === 'when' && (
        <section
          className="flex flex-col gap-3"
          role="radiogroup"
          aria-label={s('booking.when_title')}
        >
          <Choice
            selected={when === 'now'}
            onSelect={() => setWhen('now')}
            icon={<Clock aria-hidden className="size-6 shrink-0" />}
            title={s('booking.when_now')}
            hint={s('booking.when_now_hint')}
            audioKey="booking.when_now"
            testId="when-now"
          />
          <Choice
            selected={when === 'emergency'}
            onSelect={() => setWhen('emergency')}
            icon={<Siren aria-hidden className="size-6 shrink-0 text-red-700" />}
            title={s('booking.when_emergency')}
            hint={s('booking.when_emergency_hint')}
            audioKey="booking.when_emergency"
            testId="when-emergency"
          />
          <Choice
            selected={when === 'slot'}
            onSelect={() => setWhen('slot')}
            icon={<CalendarDays aria-hidden className="size-6 shrink-0" />}
            title={s('booking.when_slot')}
            hint={s('booking.when_slot_hint')}
            audioKey="booking.when_slot"
            testId="when-slot"
          />
          {when === 'slot' &&
            (slotDays.length === 0 ? (
              <p className={mutedTextClass}>{s('booking.no_slots')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">{s('booking.slot_day')}</h2>
                <div className="flex flex-wrap gap-2">
                  {slotDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      aria-pressed={day.key === slotDay}
                      onClick={() => {
                        setSlotDay(day.key);
                        setSlot(null);
                      }}
                      className={`min-h-12 rounded-xl border-2 px-3 text-base font-medium ${day.key === slotDay ? choiceSelectedClass : choiceIdleClass}`}
                      data-testid={`slot-day-${day.key}`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <h2 className="text-lg font-semibold">{s('booking.slot_time')}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {selectedDay?.slots.map((option) => (
                    <button
                      key={option.iso}
                      type="button"
                      aria-pressed={option.iso === slot}
                      onClick={() => setSlot(option.iso)}
                      className={`min-h-12 rounded-xl border-2 px-2 text-base font-medium ${option.iso === slot ? choiceSelectedClass : choiceIdleClass}`}
                      data-testid="slot-option"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </section>
      )}

      {stepName === 'quote' && (
        <section className="flex flex-col gap-4">
          {quoteLoading && (
            <p role="status" className="flex items-center gap-2 text-lg">
              <LoaderCircle aria-hidden className="size-6 animate-spin" />
              {s('booking.quote_loading')}
            </p>
          )}
          {quote !== null && (
            <div className={cardClass} data-testid="quote">
              <p className={mutedTextClass}>
                {fill(s('booking.quote_minutes'), { minutes: quote.billableMinutes })}
              </p>
              <dl className="flex flex-col gap-2">
                {lines.map((line) => (
                  <div key={line.key} className="flex flex-col">
                    <div className="flex items-baseline justify-between gap-3 text-base">
                      <dt className="break-words">{s(line.key)}</dt>
                      <dd
                        className="shrink-0 font-medium tabular-nums"
                        data-testid={`quote-line-${line.key}`}
                      >
                        {formatPaise(line.amount, locale)}
                      </dd>
                    </div>
                    {line.key === 'pricing.welfare' && (
                      <p className="text-sm text-emerald-800 dark:text-emerald-300">
                        {s('booking.quote_welfare_note')}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
              <div className="flex items-center justify-between gap-3 border-t-2 border-neutral-300 pt-3">
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">{s('booking.quote_total')}</span>
                  <span className="text-3xl font-bold tabular-nums" data-testid="quote-total">
                    {total}
                  </span>
                </div>
                <AudioButton text={fill(s('booking.quote_total_audio'), { amount: total })} />
              </div>
              {quote.isPlaceholder && (
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {s('booking.quote_placeholder_note')}
                </p>
              )}
            </div>
          )}
          {quote === null && !quoteLoading && (
            <button type="button" onClick={() => void loadQuote()} className={secondaryButtonClass}>
              <RotateCcw aria-hidden className="size-5" />
              {s('booking.quote_retry')}
            </button>
          )}
        </section>
      )}

      {error !== null && (
        <p role="alert" className={errorTextClass} data-testid="wizard-error">
          {error}
        </p>
      )}

      <nav className="mt-auto flex flex-col gap-3">
        {stepName === 'quote' ? (
          <Row audio={<AudioLabel k="booking.confirm" text={s('booking.confirm')} />}>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={quote === null || submitting}
              className={primaryButtonClass}
              data-testid="confirm"
            >
              {submitting ? (
                <LoaderCircle aria-hidden className="size-5 animate-spin" />
              ) : (
                <Check aria-hidden className="size-5" />
              )}
              {submitting ? s('booking.confirming') : s('booking.confirm')}
            </button>
          </Row>
        ) : (
          <Row audio={<AudioLabel k="common.next" text={s('common.next')} />}>
            <button type="button" onClick={next} className={primaryButtonClass} data-testid="next">
              {s('common.next')}
              <ArrowRight aria-hidden className="size-5" />
            </button>
          </Row>
        )}
        <Row audio={<AudioLabel k="common.back" text={s('common.back')} />}>
          {step === 0 ? (
            <Link href="/app" className={secondaryButtonClass} data-testid="back">
              <ArrowLeft aria-hidden className="size-5" />
              {s('common.back')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className={secondaryButtonClass}
              data-testid="back"
            >
              <ArrowLeft aria-hidden className="size-5" />
              {s('common.back')}
            </button>
          )}
        </Row>
      </nav>
    </main>
  );
}

function Row({ children, audio }: { children: ReactNode; audio: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {children}
      {audio}
    </div>
  );
}

function Choice(props: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  hint: string;
  audioKey: string;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="radio"
        aria-checked={props.selected}
        onClick={props.onSelect}
        className={`${choiceClass} ${props.selected ? choiceSelectedClass : choiceIdleClass}`}
        data-testid={props.testId}
      >
        {props.icon}
        <span className="flex flex-col">
          <span className="font-semibold">{props.title}</span>
          <span className="text-base text-neutral-700 dark:text-neutral-300">{props.hint}</span>
        </span>
      </button>
      <AudioLabel k={props.audioKey} text={props.title} />
    </div>
  );
}
