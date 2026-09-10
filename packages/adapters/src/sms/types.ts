/**
 * SMS adapter interface (AGENTS.md 3, 4.5). Services depend on this file only;
 * implementations (mock, real) are chosen by SMS_MODE / ADAPTER_MODE. Message
 * text is always rendered from the i18n `sms` namespace, never written in code.
 */
import { formatMessage, type Locale, type MessageParams } from '@kaithangu/i18n';

export { isNotConfiguredError, NotConfiguredError } from '../notConfigured';

export const SMS_TEMPLATE_KEYS = [
  'login_otp',
  'job_offer',
  'job_otps',
  'booking_unassigned',
] as const;
export type SmsTemplateKey = (typeof SMS_TEMPLATE_KEYS)[number];

export interface SmsMessage {
  /** E.164 phone number. */
  to: string;
  templateKey: SmsTemplateKey;
  params: MessageParams;
  locale: Locale;
}

export interface SmsAdapter {
  send(message: SmsMessage): Promise<void>;
}

/** The text an SMS template renders to in the message's locale. */
export function renderSms(message: SmsMessage): string {
  return formatMessage(message.locale, `sms.${message.templateKey}`, message.params);
}
