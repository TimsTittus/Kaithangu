import { describe, expect, it, vi } from 'vitest';
import { createNotifyDeliveryService } from './notifyDelivery';

describe('notifyDelivery', () => {
  it('delivers app notification by saving to notification repo', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const service = createNotifyDeliveryService({
      notifications: { create },
      sms: { send: vi.fn() },
      telephony: { call: vi.fn() },
    });

    await service.deliver({
      userId: 'user-1',
      bookingId: 'booking-1',
      channel: 'app',
      kind: 'job_offer',
      titleKey: 'notification.job_offer',
      params: { trade: 'plumber' },
      locale: 'en',
      phone: '+919999999999',
    });

    expect(create).toHaveBeenCalledWith({
      userId: 'user-1',
      bookingId: 'booking-1',
      channel: 'app',
      kind: 'job_offer',
      titleKey: 'notification.job_offer',
      params: { trade: 'plumber' },
    });
  });

  it('delivers SMS notification stripping prefix from titleKey', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const service = createNotifyDeliveryService({
      notifications: { create: vi.fn() },
      sms: { send },
      telephony: { call: vi.fn() },
    });

    await service.deliver({
      userId: 'user-1',
      bookingId: 'booking-1',
      channel: 'sms',
      kind: 'job_offer',
      titleKey: 'sms.job_offer',
      params: { trade: 'plumber' },
      locale: 'ml',
      phone: '+919999999999',
    });

    expect(send).toHaveBeenCalledWith({
      to: '+919999999999',
      templateKey: 'job_offer',
      params: { trade: 'plumber' },
      locale: 'ml',
    });
  });

  it('delivers telephony call stripping prefix from titleKey', async () => {
    const call = vi.fn().mockResolvedValue(undefined);
    const service = createNotifyDeliveryService({
      notifications: { create: vi.fn() },
      sms: { send: vi.fn() },
      telephony: { call },
    });

    await service.deliver({
      userId: 'user-1',
      bookingId: 'booking-1',
      channel: 'ivr',
      kind: 'job_offer',
      titleKey: 'job_offer',
      params: { trade: 'plumber' },
      locale: 'en',
      phone: '+919999999999',
    });

    expect(call).toHaveBeenCalledWith({
      to: '+919999999999',
      templateKey: 'job_offer',
      params: { trade: 'plumber' },
      locale: 'en',
    });
  });

  it('skips sms/telephony when phone is null', async () => {
    const send = vi.fn();
    const call = vi.fn();
    const service = createNotifyDeliveryService({
      notifications: { create: vi.fn() },
      sms: { send },
      telephony: { call },
    });

    await service.deliver({
      userId: 'user-1',
      bookingId: 'booking-1',
      channel: 'sms',
      kind: 'job_offer',
      titleKey: 'sms.job_offer',
      params: { trade: 'plumber' },
      locale: 'en',
      phone: null,
    });

    await service.deliver({
      userId: 'user-1',
      bookingId: 'booking-1',
      channel: 'ivr',
      kind: 'job_offer',
      titleKey: 'sms.job_offer',
      params: { trade: 'plumber' },
      locale: 'en',
      phone: null,
    });

    expect(send).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
});
