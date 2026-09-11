import twilio from 'twilio';
import { getEnv } from '@/env';
import { logger } from '@/lib/logger';
import { maskPhone } from '@/lib/core';
import { renderSms, type LoginOtpCheck, type SmsAdapter } from './types';

export {
  isNotConfiguredError,
  NotConfiguredError,
  renderSms,
  SMS_TEMPLATE_KEYS,
  type LoginOtpCheck,
  type SmsAdapter,
  type SmsMessage,
  type SmsTemplateKey,
} from './types';

function client() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = getEnv();
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

function logTwilioFailure(msg: string, to: string, error: unknown): void {
  const err = error as { status?: number; code?: number; message?: string };
  logger.warn(
    {
      status: err.status,
      twilioCode: err.code,
      twilioMessage: err.message,
      to: maskPhone(to),
    },
    msg,
  );
}

/** Login OTP uses Twilio Verify. Other SMS uses the Messaging API. */
export function createSmsAdapter(): SmsAdapter {
  return {
    async send(message) {
      const twilioClient = client();

      if (message.templateKey === 'login_otp') {
        const { TWILIO_VERIFY_SERVICE_SID } = getEnv();
        try {
          await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({
            channel: 'sms',
            to: message.to,
          });
        } catch (error) {
          logTwilioFailure('twilio verify start failed', message.to, error);
          throw error instanceof Error ? error : new Error('sms delivery failed');
        }
        return;
      }

      const { TWILIO_PHONE_NUMBER } = getEnv();
      try {
        await twilioClient.messages.create({
          to: message.to,
          from: TWILIO_PHONE_NUMBER,
          body: renderSms(message),
        });
      } catch (error) {
        logTwilioFailure('twilio sms failed', message.to, error);
        throw error instanceof Error ? error : new Error('sms delivery failed');
      }
    },

    async checkLoginOtp(to, code): Promise<LoginOtpCheck> {
      const { TWILIO_VERIFY_SERVICE_SID } = getEnv();
      try {
        const verificationCheck = await client()
          .verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
          .verificationChecks.create({ code, to });
        if (verificationCheck.status === 'approved') return 'approved';
        if (verificationCheck.status === 'canceled' || verificationCheck.status === 'expired') {
          return 'expired';
        }
        return 'invalid';
      } catch (error) {
        const err = error as { status?: number; code?: number };
        if (err.code === 60202) return 'attempts_exceeded';
        if (err.status === 404 || err.code === 20404) return 'expired';
        logTwilioFailure('twilio verify check failed', to, error);
        throw error instanceof Error ? error : new Error('otp check failed');
      }
    },
  };
}
