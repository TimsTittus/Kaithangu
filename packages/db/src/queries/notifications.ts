import type { NotificationRepo } from '@kaithangu/core';
import type { Database } from '../client';
import { notifications } from '../schema';

export function createNotificationRepo(db: Database): NotificationRepo {
  return {
    async create(input) {
      await db.insert(notifications).values({
        userId: input.userId,
        bookingId: input.bookingId,
        channel: input.channel,
        kind: input.kind,
        titleKey: input.titleKey,
        params: input.params,
      });
    },
  };
}
