/**
 * Consent (Phase 4). After the first sign-in every identity accepts the platform
 * terms shown at /consent; the version comes from the i18n catalog
 * (`consent.version`), so changing the text and bumping the version asks
 * everyone again. Booking services call assertConsented before creating a
 * booking.
 */
import { getMessage } from '@/lib/i18n';
import { requireRole } from '../authz';
import { ROLES, type RequestContext, type Role } from '../context';
import { AppError } from '../errors';

export const CONSENT_PURPOSES = ['platform_terms'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** The current platform-terms version (identical in every locale; tested in i18n). */
export function currentConsentVersion(): string {
  const version = getMessage('en', 'consent.version');
  if (version === undefined) throw new Error('i18n: consent.version is missing');
  return version;
}

export interface ConsentRecordInput {
  actorRole: Role;
  actorId: string;
  purpose: ConsentPurpose;
  version: string;
  evidence: Record<string, unknown>;
}

export interface ConsentRepo {
  has(actorRole: Role, actorId: string, purpose: ConsentPurpose, version: string): Promise<boolean>;
  record(input: ConsentRecordInput): Promise<void>;
}

export function createConsentService({ consents }: { consents: ConsentRepo }) {
  const signedIn = (ctx: RequestContext | null) => requireRole(ctx, ROLES);

  async function hasAcceptedTerms(ctx: RequestContext | null): Promise<boolean> {
    const { actor } = signedIn(ctx);
    return consents.has(actor.role, actor.userId, 'platform_terms', currentConsentVersion());
  }

  return {
    hasAcceptedTerms,

    /** Record acceptance of the current terms. Idempotent. */
    async acceptTerms(ctx: RequestContext | null): Promise<void> {
      const signed = signedIn(ctx);
      const version = currentConsentVersion();
      if (await consents.has(signed.actor.role, signed.actor.userId, 'platform_terms', version)) {
        return;
      }
      await consents.record({
        actorRole: signed.actor.role,
        actorId: signed.actor.userId,
        purpose: 'platform_terms',
        version,
        evidence: { locale: signed.locale, requestId: signed.requestId },
      });
    },

    /** Throws AppError('CONSENT_REQUIRED') unless the current terms were accepted. */
    async assertConsented(ctx: RequestContext | null): Promise<void> {
      if (!(await hasAcceptedTerms(ctx))) throw new AppError('CONSENT_REQUIRED');
    },
  };
}

export type ConsentService = ReturnType<typeof createConsentService>;
