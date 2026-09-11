import { formatMessage, type Locale, type MessageParams } from '@/lib/i18n';

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

export type LoginOtpCheck = 'approved' | 'invalid' | 'expired' | 'attempts_exceeded';

export interface SmsAdapter {
  send(message: SmsMessage): Promise<void>;
  /** Confirm the Twilio Verify code that was texted to this number. */
  checkLoginOtp(to: string, code: string): Promise<LoginOtpCheck>;
}

export function renderSms(message: SmsMessage): string {
  return formatMessage(message.locale, `sms.${message.templateKey}`, message.params);
}
