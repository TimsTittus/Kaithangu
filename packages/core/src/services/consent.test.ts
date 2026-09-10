import { getMessage } from '@kaithangu/i18n';
import { describe, expect, it } from 'vitest';
import { systemContext, type RequestContext } from '../context';
import { AppError } from '../errors';
import {
  createConsentService,
  currentConsentVersion,
  type ConsentRecordInput,
  type ConsentRepo,
} from './consent';

class MemoryConsents implements ConsentRepo {
  readonly rows: ConsentRecordInput[] = [];

  has(userId: string, purpose: string, version: string) {
    return Promise.resolve(
      this.rows.some((r) => r.userId === userId && r.purpose === purpose && r.version === version),
    );
  }

  record(input: ConsentRecordInput) {
    this.rows.push(input);
    return Promise.resolve();
  }
}

const ctx: RequestContext = {
  actor: { userId: 'user-1', role: 'customer', stateCode: 'KL' },
  requestId: 'req-1',
  locale: 'ml',
};

describe('consent service', () => {
  it('uses the version from the i18n catalog', () => {
    expect(currentConsentVersion()).toBe(getMessage('en', 'consent.version'));
  });

  it('records acceptance once, with locale and request id as evidence', async () => {
    const consents = new MemoryConsents();
    const service = createConsentService({ consents });
    await expect(service.hasAcceptedTerms(ctx)).resolves.toBe(false);
    await expect(service.assertConsented(ctx)).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
      httpStatus: 403,
    });

    await service.acceptTerms(ctx, 'web');
    await service.acceptTerms(ctx, 'web');
    expect(consents.rows).toEqual([
      {
        userId: 'user-1',
        purpose: 'platform_terms',
        version: currentConsentVersion(),
        channel: 'web',
        evidence: { locale: 'ml', requestId: 'req-1' },
      },
    ]);
    await expect(service.hasAcceptedTerms(ctx)).resolves.toBe(true);
    await expect(service.assertConsented(ctx)).resolves.toBeUndefined();
  });

  it('an older version does not count', async () => {
    const consents = new MemoryConsents();
    consents.rows.push({
      userId: 'user-1',
      purpose: 'platform_terms',
      version: 'old',
      channel: 'web',
      evidence: {},
    });
    await expect(createConsentService({ consents }).hasAcceptedTerms(ctx)).resolves.toBe(false);
  });

  it('requires a signed-in user', async () => {
    const service = createConsentService({ consents: new MemoryConsents() });
    await expect(service.acceptTerms(null, 'web')).rejects.toBeInstanceOf(AppError);
    await expect(service.hasAcceptedTerms(systemContext('x'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
