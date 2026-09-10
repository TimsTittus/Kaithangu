/**
 * SMS adapter interface (AGENTS.md 3, 4.5). Services depend on this file only;
 * implementations (mock, real) are chosen by SMS_MODE / ADAPTER_MODE. Message
 * text is always rendered from the i18n `sms` namespace, never written in code.
 */
import { formatMessage, type Locale, type MessageParams } from '@kaithangu/i18n';

export const SMS_TEMPLATE_KEYS = ['login_otp'] as const;
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

/** Thrown by a real adapter whose provider has not been set up yet. */
export class NotConfiguredError extends Error {
  readonly code = 'NOT_CONFIGURED';

  constructor(readonly adapter: string) {
    super(`${adapter} adapter is not configured`);
    this.name = 'NotConfiguredError';
  }
}

export function isNotConfiguredError(value: unknown): value is NotConfiguredError {
  return value instanceof NotConfiguredError;
}

/** The text an SMS template renders to in the message's locale. */
export function renderSms(message: SmsMessage): string {
  return formatMessage(message.locale, `sms.${message.templateKey}`, message.params);
}
