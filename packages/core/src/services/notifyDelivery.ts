/**
 * Delivers one notify job (AGENTS.md 6.4 "Notification service"). Channel
 * routing only — the notify queue's job payload already carries a resolved
 * i18n key and params (packages/i18n `notification`/`sms` namespaces); this
 * never decides *whether* to notify, only *how* to send what dispatch.ts
 * already decided. apps/jobs' notify consumer calls `deliver` and, on a
 * thrown error, republishes with backoff (AGENTS.md: retries are for notify
 * only, never for a dispatch decision).
 */
import type { Locale, MessageParams } from '@kaithangu/i18n';
import type { NotifyInput, OfferChannel } from './dispatch';

export interface NotificationRepo {
  create(input: {
    userId: string;
    bookingId: string | null;
    channel: OfferChannel;
    kind: string;
    titleKey: string;
    params: Record<string, unknown>;
  }): Promise<void>;
}

export interface DeliverySmsAdapter {
  send(message: {
    to: string;
    templateKey: string;
    params: MessageParams;
    locale: Locale;
  }): Promise<void>;
}

export interface DeliveryTelephonyAdapter {
  call(message: {
    to: string;
    templateKey: string;
    params: MessageParams;
    locale: Locale;
  }): Promise<void>;
}

export interface NotifyDeliveryDeps {
  notifications: NotificationRepo;
  sms: DeliverySmsAdapter;
  telephony: DeliveryTelephonyAdapter;
}

/** The sms/voice template key for a titleKey (`sms.job_offer` -> `job_offer`). */
function templateKeyFrom(titleKey: string): string {
  const dot = titleKey.indexOf('.');
  return dot === -1 ? titleKey : titleKey.slice(dot + 1);
}

export function createNotifyDeliveryService(deps: NotifyDeliveryDeps) {
  return {
    async deliver(input: NotifyInput): Promise<void> {
      if (input.channel === 'app') {
        await deps.notifications.create({
          userId: input.userId,
          bookingId: input.bookingId,
          channel: 'app',
          kind: input.kind,
          titleKey: input.titleKey,
          params: input.params,
        });
        return;
      }
      if (input.phone === null) return;
      const templateKey = templateKeyFrom(input.titleKey);
      if (input.channel === 'sms') {
        await deps.sms.send({
          to: input.phone,
          templateKey,
          params: input.params,
          locale: input.locale,
        });
        return;
      }
      await deps.telephony.call({
        to: input.phone,
        templateKey,
        params: input.params,
        locale: input.locale,
      });
    },
  };
}

export type NotifyDeliveryService = ReturnType<typeof createNotifyDeliveryService>;
