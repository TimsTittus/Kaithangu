/**
 * Telephony (IVR) adapter interface (AGENTS.md 3, 4.5, 6.4). Services depend
 * on this file only; implementations (mock, real) are chosen by
 * TELEPHONY_MODE / ADAPTER_MODE. This phase only needs an outbound call
 * placed (dispatch offers/alerts to a non-smartphone worker); the actual IVR
 * conversation (DTMF prompts, call handling) is a later voice-phase concern —
 * apps/voice has no Twilio integration yet. Call text is rendered from the
 * i18n `sms` namespace (shared with SMS, since the mock only ever logs it).
 */
import { formatMessage, type Locale, type MessageParams } from '@kaithangu/i18n';

export { isNotConfiguredError, NotConfiguredError } from '../notConfigured';

export const TELEPHONY_TEMPLATE_KEYS = ['job_offer', 'booking_unassigned'] as const;
export type TelephonyTemplateKey = (typeof TELEPHONY_TEMPLATE_KEYS)[number];

export interface TelephonyCall {
  /** E.164 phone number. */
  to: string;
  templateKey: TelephonyTemplateKey;
  params: MessageParams;
  locale: Locale;
}

export interface TelephonyAdapter {
  call(input: TelephonyCall): Promise<void>;
}

/** The text an IVR call would read out, in the call's locale. */
export function renderCall(input: TelephonyCall): string {
  return formatMessage(input.locale, `sms.${input.templateKey}`, input.params);
}
