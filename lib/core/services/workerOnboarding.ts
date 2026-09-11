/**
 * Voice-agent worker onboarding. Sarvam Indus tool calls land here: OTP,
 * resume lookup, pincode geocode, partial saves, and final submit. The agent
 * never marks a worker verified; submit leaves worker.status = pending.
 */
import { z } from 'zod';
import { isNotConfiguredError, type SmsAdapter } from '@/lib/adapters/sms/types';
import { isSupportedLocale, type Locale } from '@/lib/i18n';
import type { RequestContext, Role } from '../context';
import type { LngLat } from '../geo';
import { normalizeIndianPhone } from '../phone';
import { isCertifiedRequired, isTradeCode, type TradeCode } from '../trades';
import { parseInput } from '../validation';
import type { UserRepo } from './auth';
import { PINCODE_PATTERN, type PlaceRepo } from './bookings';
import type { ConsentPurpose, ConsentRepo } from './consent';
import type { WorkerStatus } from './workers';

export const AI_WEBHOOK_TOOLS = [
  'send_otp',
  'verify_otp',
  'fetch_worker_profile',
  'geocode_pincode',
  'save_worker_progress',
  'submit_worker_profile',
] as const;

export type AiWebhookTool = (typeof AI_WEBHOOK_TOOLS)[number];

export function isAiWebhookTool(value: string): value is AiWebhookTool {
  return (AI_WEBHOOK_TOOLS as readonly string[]).includes(value);
}

export const WORKER_ONBOARDING_STEPS = [
  'name',
  'language',
  'smartphone',
  'trades',
  'skills',
  'service_area',
  'availability',
  'payout',
  'certification',
  'consent',
  'fairness',
  'confirmation',
] as const;
export type WorkerOnboardingStep = (typeof WORKER_ONBOARDING_STEPS)[number];

export const WORKER_REGISTRATION_STATUSES = ['in_progress', 'submitted'] as const;
export type WorkerRegistrationStatus = (typeof WORKER_REGISTRATION_STATUSES)[number];

export const WORKER_AVAILABILITY_DAYS = ['weekdays', 'weekends', 'all_days'] as const;
export type WorkerAvailabilityDays = (typeof WORKER_AVAILABILITY_DAYS)[number];

export const WORKER_AVAILABILITY_HOURS = [
  'mornings',
  'afternoons',
  'evenings',
  'full_day',
] as const;
export type WorkerAvailabilityHours = (typeof WORKER_AVAILABILITY_HOURS)[number];

export const WORKER_CERTIFICATION_STATUSES = [
  'not_required',
  'pending_upload',
  'pending_review',
] as const;
export type WorkerCertificationStatus = (typeof WORKER_CERTIFICATION_STATUSES)[number];

export const SERVICE_RADIUS_KM = [2, 5, 10] as const;
export type ServiceRadiusKm = (typeof SERVICE_RADIUS_KM)[number];

export type WorkerSkillLevel = 1 | 2 | 3;

export const VOICE_CONSENT_VERSION = 'voice.v1';

export interface WorkerSkillRecord {
  tradeCode: TradeCode;
  level: WorkerSkillLevel;
}

export interface WorkerServiceAreaRecord {
  position: 1 | 2;
  pincode: string;
  location: LngLat | null;
  needsFollowup: boolean;
}

export interface WorkerOnboardingRecord {
  id: string;
  phone: string;
  name: string | null;
  locale: string | null;
  status: WorkerStatus;
  registrationStatus: WorkerRegistrationStatus;
  onboardingStep: WorkerOnboardingStep | null;
  hasSmartphone: boolean;
  serviceRadiusKm: ServiceRadiusKm | null;
  availabilityDays: WorkerAvailabilityDays | null;
  availabilityHours: WorkerAvailabilityHours | null;
  upiId: string | null;
  certificationStatus: WorkerCertificationStatus | null;
  consentDataUse: boolean;
  consentRecordingRetention: boolean;
  fairnessExplained: boolean;
  identityVerifiedAt: Date | null;
  submittedAt: Date | null;
  lastInteractionId: string | null;
  skills: WorkerSkillRecord[];
  serviceAreas: WorkerServiceAreaRecord[];
}

export interface WorkerOnboardingPatch {
  name?: string;
  locale?: Locale;
  hasSmartphone?: boolean;
  onboardingStep?: WorkerOnboardingStep;
  serviceRadiusKm?: ServiceRadiusKm | null;
  availabilityDays?: WorkerAvailabilityDays | null;
  availabilityHours?: WorkerAvailabilityHours | null;
  upiId?: string | null;
  certificationStatus?: WorkerCertificationStatus | null;
  consentDataUse?: boolean;
  consentRecordingRetention?: boolean;
  fairnessExplained?: boolean;
  lastInteractionId?: string;
  skills?: WorkerSkillRecord[];
  serviceAreas?: WorkerServiceAreaRecord[];
}

export interface WorkerOnboardingRepo {
  findByPhone(phone: string): Promise<WorkerOnboardingRecord | null>;
  updateProfile(workerId: string, patch: WorkerOnboardingPatch): Promise<void>;
  markIdentityVerified(workerId: string, at: Date): Promise<void>;
  markSubmitted(workerId: string, at: Date): Promise<void>;
}

export interface WorkerOnboardingDeps {
  sms: SmsAdapter;
  users: UserRepo;
  onboarding: WorkerOnboardingRepo;
  places: PlaceRepo;
  consents: ConsentRepo;
  defaultStateCode: string;
  now?: () => Date;
}

const phoneBodySchema = z.object({
  worker_phone: z.string().min(1).max(32),
});

const verifyOtpBodySchema = phoneBodySchema.extend({
  otp: z.string().min(1).max(32),
});

const geocodeBodySchema = z.object({
  pincode: z.string().min(1).max(32),
});

const NAME_MAX = 200;
const INTERACTION_ID_MAX = 128;
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function firstString(body: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function hasKey(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;
  const normalised = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalised)) return true;
  if (['false', 'no', 'n', '0'].includes(normalised)) return false;
  return undefined;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function parsePreferredLocale(value: string): Locale | undefined {
  const trimmed = value.trim().toLowerCase();
  const primary = trimmed.split(/[-_]/)[0] ?? '';
  if (isSupportedLocale(primary)) return primary;
  const compact = trimmed.replace(/[\s_-]+/g, '');
  const aliases: Record<string, Locale> = {
    english: 'en',
    malayalam: 'ml',
    hindi: 'hi',
    tamil: 'ta',
  };
  return aliases[compact];
}

export function parseSkillLevel(value: unknown): WorkerSkillLevel | undefined {
  if (typeof value === 'number' && (value === 1 || value === 2 || value === 3)) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const compact = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (compact === '1' || compact === 'just_starting' || compact === 'just_starting_out') return 1;
  if (compact === 'beginner' || compact === 'starting') return 1;
  if (compact === '2' || compact === 'experienced') return 2;
  if (compact === '3' || compact === 'expert') return 3;
  return undefined;
}

function skillLabel(level: WorkerSkillLevel): 'just_starting' | 'experienced' | 'expert' {
  if (level === 1) return 'just_starting';
  if (level === 2) return 'experienced';
  return 'expert';
}

export function parseServiceRadius(value: unknown): ServiceRadiusKm | undefined {
  if (typeof value === 'number' && (SERVICE_RADIUS_KM as readonly number[]).includes(value)) {
    return value as ServiceRadiusKm;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const match = String(value).match(/(\d+(?:\.\d+)?)/);
    if (match === null) return undefined;
    const n = Number(match[1]);
    if (n === 2 || n === 5 || n === 10) return n;
    if (!Number.isFinite(n) || n <= 0) return undefined;
    const nearest = SERVICE_RADIUS_KM.reduce((best, preset) =>
      Math.abs(preset - n) < Math.abs(best - n) ? preset : best,
    );
    return nearest;
  }
  return undefined;
}

export function parseAvailabilityDays(value: string): WorkerAvailabilityDays | undefined {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (compact === 'weekdays' || compact === 'weekday') return 'weekdays';
  if (compact === 'weekends' || compact === 'weekend') return 'weekends';
  if (
    compact === 'all_days' ||
    compact === 'alldays' ||
    compact === 'everyday' ||
    compact === 'daily'
  ) {
    return 'all_days';
  }
  return (WORKER_AVAILABILITY_DAYS as readonly string[]).includes(compact)
    ? (compact as WorkerAvailabilityDays)
    : undefined;
}

export function parseAvailabilityHours(value: string): WorkerAvailabilityHours | undefined {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (compact === 'morning' || compact === 'mornings') return 'mornings';
  if (compact === 'afternoon' || compact === 'afternoons') return 'afternoons';
  if (compact === 'evening' || compact === 'evenings') return 'evenings';
  if (compact === 'full_day' || compact === 'fullday' || compact === 'all_day') return 'full_day';
  return (WORKER_AVAILABILITY_HOURS as readonly string[]).includes(compact)
    ? (compact as WorkerAvailabilityHours)
    : undefined;
}

function looksLikeForbiddenPayout(value: string): boolean {
  const compact = value.replace(/[\s-]/g, '');
  if (/^\d{12}$/.test(compact)) return true;
  if (/^\d{13,19}$/.test(compact)) return true;
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(compact)) return true;
  return !value.includes('@');
}

export function parseUpiId(value: string): string | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (looksLikeForbiddenPayout(trimmed)) return 'invalid';
  const normalised = trimmed.toLowerCase();
  return UPI_PATTERN.test(normalised) ? normalised : 'invalid';
}

function parseOnboardingStep(value: string): WorkerOnboardingStep | undefined {
  const step = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (WORKER_ONBOARDING_STEPS as readonly string[]).includes(step)
    ? (step as WorkerOnboardingStep)
    : undefined;
}

function parseCertificationStatus(value: string): WorkerCertificationStatus | undefined {
  const status = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (WORKER_CERTIFICATION_STATUSES as readonly string[]).includes(status)
    ? (status as WorkerCertificationStatus)
    : undefined;
}

function parseTradeCode(value: string): TradeCode | undefined {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return isTradeCode(compact) ? compact : undefined;
}

function parseSkills(body: Record<string, unknown>): WorkerSkillRecord[] | undefined {
  const rawTrades = body.trades ?? body.trade;
  if (rawTrades === undefined) return undefined;
  const items: unknown[] = Array.isArray(rawTrades)
    ? rawTrades
    : typeof rawTrades === 'string'
      ? rawTrades.split(/[,/]/)
      : [rawTrades];
  const levelsRaw = body.skill_levels ?? body.skill_level;
  const levels: unknown[] = Array.isArray(levelsRaw)
    ? levelsRaw
    : levelsRaw === undefined
      ? []
      : [levelsRaw];

  const skills: WorkerSkillRecord[] = [];
  for (const [index, item] of items.entries()) {
    if (typeof item === 'string') {
      const tradeCode = parseTradeCode(item);
      const level = parseSkillLevel(levels[index]);
      if (tradeCode !== undefined && level !== undefined) skills.push({ tradeCode, level });
      continue;
    }
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const tradeValue = firstString(record, ['trade', 'trade_code', 'code']);
    const tradeCode = tradeValue === undefined ? undefined : parseTradeCode(tradeValue);
    const level = parseSkillLevel(record.skill_level ?? record.level ?? levels[index]);
    if (tradeCode !== undefined && level !== undefined) skills.push({ tradeCode, level });
  }
  const seen = new Set<TradeCode>();
  const unique = skills.filter((skill) => {
    if (seen.has(skill.tradeCode)) return false;
    seen.add(skill.tradeCode);
    return true;
  });
  if (items.length > 0 && unique.length === 0) return undefined;
  return unique;
}

function parsePincodes(body: Record<string, unknown>): string[] | undefined {
  const raw = body.service_areas ?? body.pincodes ?? body.pincode;
  if (raw === undefined) return undefined;
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  const pincodes: string[] = [];
  for (const item of items) {
    const value =
      typeof item === 'string' || typeof item === 'number'
        ? String(item)
        : typeof item === 'object' && item !== null
          ? firstString(item as Record<string, unknown>, ['pincode'])
          : undefined;
    if (value === undefined) continue;
    const pincode = digitsOnly(value);
    if (PINCODE_PATTERN.test(pincode) && !pincodes.includes(pincode)) pincodes.push(pincode);
  }
  return pincodes.slice(0, 2);
}

function agentStatus(record: WorkerOnboardingRecord): string {
  if (record.status === 'verified') return 'verified';
  if (record.status === 'suspended') return 'suspended';
  if (record.registrationStatus === 'submitted') return 'pending_verification';
  return 'in_progress';
}

function profilePayload(record: WorkerOnboardingRecord): Record<string, unknown> {
  return {
    found: true,
    status: agentStatus(record),
    resume_step: record.onboardingStep,
    existing_worker_name: record.name,
    worker_id: record.id,
    locale: record.locale,
    has_smartphone: record.hasSmartphone,
    trades: record.skills.map((skill) => ({
      trade: skill.tradeCode,
      skill_level: skillLabel(skill.level),
    })),
    pincodes: record.serviceAreas
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((area) => ({
        pincode: area.pincode,
        needs_followup: area.needsFollowup,
      })),
    service_radius_km: record.serviceRadiusKm,
    availability_days: record.availabilityDays,
    availability_hours: record.availabilityHours,
    upi_id: record.upiId,
    certification_status: record.certificationStatus,
    consent_data_use: record.consentDataUse,
    consent_recording_retention: record.consentRecordingRetention,
    fairness_explained: record.fairnessExplained,
    identity_verified: record.identityVerifiedAt !== null,
  };
}

function deriveCertification(
  skills: WorkerSkillRecord[],
  explicit: WorkerCertificationStatus | undefined,
): WorkerCertificationStatus | undefined {
  if (explicit !== undefined) return explicit;
  if (skills.length === 0) return undefined;
  return skills.some((skill) => isCertifiedRequired(skill.tradeCode))
    ? 'pending_upload'
    : 'not_required';
}

function inferStep(
  current: WorkerOnboardingStep | null,
  patch: WorkerOnboardingPatch,
): WorkerOnboardingStep | undefined {
  if (patch.onboardingStep !== undefined) return patch.onboardingStep;
  const ordered: Array<[boolean, WorkerOnboardingStep]> = [
    [patch.name !== undefined, 'name'],
    [patch.locale !== undefined, 'language'],
    [patch.hasSmartphone !== undefined, 'smartphone'],
    [patch.skills !== undefined, 'skills'],
    [patch.serviceAreas !== undefined || patch.serviceRadiusKm !== undefined, 'service_area'],
    [patch.availabilityDays !== undefined || patch.availabilityHours !== undefined, 'availability'],
    [patch.upiId !== undefined, 'payout'],
    [patch.certificationStatus !== undefined, 'certification'],
    [patch.consentDataUse !== undefined, 'consent'],
    [patch.fairnessExplained === true, 'fairness'],
  ];
  let inferred: WorkerOnboardingStep | undefined;
  for (const [present, step] of ordered) {
    if (present) inferred = step;
  }
  return inferred ?? current ?? undefined;
}

function conflictResponse(existingRole: Role): Record<string, unknown> {
  return { found: false, status: 'conflict', existing_role: existingRole };
}

export function createWorkerOnboardingService(deps: WorkerOnboardingDeps) {
  const now = deps.now ?? (() => new Date());

  async function requirePhone(body: unknown): Promise<string> {
    const raw = asRecord(body);
    const workerPhone = firstString(raw, ['worker_phone', 'phone']) ?? '';
    return normalizeIndianPhone(
      parseInput(phoneBodySchema, { worker_phone: workerPhone }).worker_phone,
    );
  }

  async function resolveAreas(pincodes: string[]): Promise<WorkerServiceAreaRecord[]> {
    const areas: WorkerServiceAreaRecord[] = [];
    for (const [index, pincode] of pincodes.entries()) {
      const geo = await deps.places.geocodePincode(pincode);
      areas.push({
        position: index === 1 ? 2 : 1,
        pincode,
        location: geo?.location ?? null,
        needsFollowup: geo === null,
      });
    }
    return areas;
  }

  async function patchFromBody(
    body: Record<string, unknown>,
    existing: WorkerOnboardingRecord | null,
  ): Promise<{ patch: WorkerOnboardingPatch; upiError: boolean }> {
    const patch: WorkerOnboardingPatch = {};
    const name = firstString(body, ['name', 'full_name', 'existing_worker_name']);
    if (name !== undefined) patch.name = name.slice(0, NAME_MAX);

    const language = firstString(body, ['language', 'locale', 'preferred_language']);
    if (language !== undefined) {
      const locale = parsePreferredLocale(language);
      if (locale !== undefined) patch.locale = locale;
    }

    const smartphone = coerceBoolean(body.has_smartphone ?? body.hasSmartphone ?? body.smartphone);
    if (smartphone !== undefined) patch.hasSmartphone = smartphone;

    const skills = parseSkills(body);
    if (skills !== undefined) patch.skills = skills;

    const pincodes = parsePincodes(body);
    if (pincodes !== undefined) patch.serviceAreas = await resolveAreas(pincodes);

    const radius = parseServiceRadius(body.service_radius_km ?? body.radius ?? body.travel_radius);
    if (radius !== undefined) patch.serviceRadiusKm = radius;

    const daysRaw = firstString(body, ['availability_days', 'days']);
    if (daysRaw !== undefined) {
      const days = parseAvailabilityDays(daysRaw);
      if (days !== undefined) patch.availabilityDays = days;
    }
    const hoursRaw = firstString(body, ['availability_hours', 'hours']);
    if (hoursRaw !== undefined) {
      const hours = parseAvailabilityHours(hoursRaw);
      if (hours !== undefined) patch.availabilityHours = hours;
    }
    const availability = firstString(body, ['availability']);
    if (availability !== undefined) {
      const days = parseAvailabilityDays(availability);
      const hours = parseAvailabilityHours(availability);
      if (days !== undefined) patch.availabilityDays = days;
      if (hours !== undefined) patch.availabilityHours = hours;
    }

    let upiError = false;
    if (hasKey(body, ['upi_id', 'upi', 'payout'])) {
      const rawUpi = firstString(body, ['upi_id', 'upi', 'payout']) ?? '';
      const parsed = parseUpiId(rawUpi);
      if (parsed === 'invalid') upiError = true;
      else patch.upiId = parsed;
    }

    const certRaw = firstString(body, ['certification_status', 'certification']);
    const explicitCert = certRaw === undefined ? undefined : parseCertificationStatus(certRaw);
    const derived = deriveCertification(skills ?? existing?.skills ?? [], explicitCert);
    if (derived !== undefined) patch.certificationStatus = derived;

    const dataUse = coerceBoolean(body.consent_data_use ?? body.consent);
    if (dataUse !== undefined) patch.consentDataUse = dataUse;
    const recording = coerceBoolean(body.consent_recording_retention ?? body.recording_consent);
    if (recording !== undefined) patch.consentRecordingRetention = recording;

    const fairness = coerceBoolean(body.fairness_explained ?? body.fairness);
    if (fairness !== undefined) patch.fairnessExplained = fairness;

    const stepRaw = firstString(body, ['onboarding_step', 'resume_step']);
    if (stepRaw !== undefined) {
      const step = parseOnboardingStep(stepRaw);
      if (step !== undefined) patch.onboardingStep = step;
    } else {
      const inferred = inferStep(existing?.onboardingStep ?? null, patch);
      if (inferred !== undefined) patch.onboardingStep = inferred;
    }

    const interactionId = firstString(body, ['interaction_id', 'call_id']);
    if (interactionId !== undefined)
      patch.lastInteractionId = interactionId.slice(0, INTERACTION_ID_MAX);

    return { patch, upiError };
  }

  async function recordVoiceConsents(
    workerId: string,
    patch: WorkerOnboardingPatch,
    interactionId: string | undefined,
  ): Promise<void> {
    const evidence = {
      source: 'voice_agent',
      interaction_id: interactionId ?? null,
      method: 'voice',
    };
    async function accept(purpose: ConsentPurpose): Promise<void> {
      if (await deps.consents.has('worker', workerId, purpose, VOICE_CONSENT_VERSION)) return;
      await deps.consents.record({
        actorRole: 'worker',
        actorId: workerId,
        purpose,
        version: VOICE_CONSENT_VERSION,
        evidence,
      });
    }
    if (patch.consentDataUse === true) await accept('worker_data_use');
    if (patch.consentRecordingRetention === true) await accept('call_recording_retention');
  }

  async function sendOtp(ctx: RequestContext, body: unknown): Promise<Record<string, unknown>> {
    const phone = await requirePhone(body);
    const existingRole = await deps.users.findPhoneRole(phone);
    if (existingRole !== null && existingRole !== 'worker') return conflictResponse(existingRole);
    try {
      await deps.sms.send({
        to: phone,
        templateKey: 'login_otp',
        params: {},
        locale: ctx.locale,
      });
    } catch (error) {
      if (isNotConfiguredError(error)) {
        return { status: 'error', code: 'NOT_CONFIGURED' };
      }
      throw error;
    }
    return { status: 'sent' };
  }

  async function verifyOtp(ctx: RequestContext, body: unknown): Promise<Record<string, unknown>> {
    const raw = asRecord(body);
    const phone = await requirePhone(body);
    const otp = digitsOnly(firstString(raw, ['otp', 'code']) ?? '');
    parseInput(verifyOtpBodySchema, { worker_phone: phone, otp });
    const existingRole = await deps.users.findPhoneRole(phone);
    if (existingRole !== null && existingRole !== 'worker') return conflictResponse(existingRole);

    let check;
    try {
      check = await deps.sms.checkLoginOtp(phone, otp);
    } catch (error) {
      if (isNotConfiguredError(error)) {
        return { status: 'error', code: 'NOT_CONFIGURED' };
      }
      throw error;
    }
    if (check === 'expired') return { status: 'expired' };
    if (check === 'attempts_exceeded') return { status: 'attempts_exceeded' };
    if (check !== 'approved') return { status: 'mismatch' };

    const { user } = await deps.users.upsertOnLogin({
      phone,
      locale: isSupportedLocale(ctx.locale) ? ctx.locale : null,
      stateCode: deps.defaultStateCode,
      role: 'worker',
    });
    await deps.onboarding.markIdentityVerified(user.id, now());
    return { status: 'verified', worker_id: user.id };
  }

  async function fetchWorkerProfile(body: unknown): Promise<Record<string, unknown>> {
    const phone = await requirePhone(body);
    const existingRole = await deps.users.findPhoneRole(phone);
    if (existingRole !== null && existingRole !== 'worker') return conflictResponse(existingRole);
    const record = await deps.onboarding.findByPhone(phone);
    if (record === null) return { found: false };
    return profilePayload(record);
  }

  async function geocodePincode(body: unknown): Promise<Record<string, unknown>> {
    const raw = asRecord(body);
    const pincode = digitsOnly(
      parseInput(geocodeBodySchema, {
        pincode: firstString(raw, ['pincode']) ?? '',
      }).pincode,
    );
    if (!PINCODE_PATTERN.test(pincode)) {
      return { found: false, reason: 'malformed' };
    }
    const geo = await deps.places.geocodePincode(pincode);
    if (geo === null) return { found: false, reason: 'unknown' };
    return {
      found: true,
      lat: geo.location.lat,
      lng: geo.location.lng,
      district: geo.district,
      office_name: geo.officeName,
      state_name: geo.stateName,
    };
  }

  async function saveWorkerProgress(body: unknown): Promise<Record<string, unknown>> {
    const phone = await requirePhone(body);
    const existingRole = await deps.users.findPhoneRole(phone);
    if (existingRole !== null && existingRole !== 'worker') return conflictResponse(existingRole);
    const record = await deps.onboarding.findByPhone(phone);
    if (record === null) return { status: 'not_found' };
    const { patch, upiError } = await patchFromBody(asRecord(body), record);
    if (upiError) return { status: 'invalid_upi', worker_id: record.id };
    await deps.onboarding.updateProfile(record.id, patch);
    await recordVoiceConsents(record.id, patch, patch.lastInteractionId);
    return { status: 'saved', worker_id: record.id };
  }

  async function submitWorkerProfile(body: unknown): Promise<Record<string, unknown>> {
    const phone = await requirePhone(body);
    const existingRole = await deps.users.findPhoneRole(phone);
    if (existingRole !== null && existingRole !== 'worker') return conflictResponse(existingRole);
    const record = await deps.onboarding.findByPhone(phone);
    if (record === null) return { status: 'not_found' };
    if (record.identityVerifiedAt === null) return { status: 'unverified' };

    const { patch, upiError } = await patchFromBody(asRecord(body), record);
    if (upiError) return { status: 'invalid_upi', worker_id: record.id };

    const merged: WorkerOnboardingRecord = {
      ...record,
      name: patch.name ?? record.name,
      locale: patch.locale ?? record.locale,
      hasSmartphone: patch.hasSmartphone ?? record.hasSmartphone,
      serviceRadiusKm: patch.serviceRadiusKm ?? record.serviceRadiusKm,
      availabilityDays: patch.availabilityDays ?? record.availabilityDays,
      availabilityHours: patch.availabilityHours ?? record.availabilityHours,
      upiId: patch.upiId !== undefined ? patch.upiId : record.upiId,
      certificationStatus: patch.certificationStatus ?? record.certificationStatus,
      consentDataUse: patch.consentDataUse ?? record.consentDataUse,
      consentRecordingRetention:
        patch.consentRecordingRetention ?? record.consentRecordingRetention,
      fairnessExplained: patch.fairnessExplained ?? record.fairnessExplained,
      skills: patch.skills ?? record.skills,
      serviceAreas: patch.serviceAreas ?? record.serviceAreas,
    };

    if (merged.certificationStatus === null) {
      merged.certificationStatus = deriveCertification(merged.skills, undefined) ?? 'not_required';
      patch.certificationStatus = merged.certificationStatus;
    }

    const missing: string[] = [];
    if (merged.name === null || merged.name.trim() === '') missing.push('name');
    if (merged.locale === null) missing.push('locale');
    if (merged.skills.length === 0) missing.push('trades');
    if (merged.serviceAreas.length === 0) missing.push('pincode');
    if (merged.serviceRadiusKm === null) missing.push('service_radius_km');
    if (merged.availabilityDays === null) missing.push('availability_days');
    if (merged.availabilityHours === null) missing.push('availability_hours');
    if (merged.certificationStatus === null) missing.push('certification_status');
    if (merged.consentDataUse !== true) missing.push('consent_data_use');
    if (merged.fairnessExplained !== true) missing.push('fairness_explained');
    if (missing.length > 0) return { status: 'incomplete', missing, worker_id: record.id };

    patch.consentDataUse = true;
    patch.fairnessExplained = true;
    patch.onboardingStep = 'confirmation';
    await deps.onboarding.updateProfile(record.id, patch);
    await recordVoiceConsents(record.id, patch, patch.lastInteractionId);
    await deps.onboarding.markSubmitted(record.id, now());
    return { status: 'pending_verification', worker_id: record.id };
  }

  return {
    handleTool(ctx: RequestContext, tool: AiWebhookTool, body: unknown) {
      switch (tool) {
        case 'send_otp':
          return sendOtp(ctx, body);
        case 'verify_otp':
          return verifyOtp(ctx, body);
        case 'fetch_worker_profile':
          return fetchWorkerProfile(body);
        case 'geocode_pincode':
          return geocodePincode(body);
        case 'save_worker_progress':
          return saveWorkerProgress(body);
        case 'submit_worker_profile':
          return submitWorkerProfile(body);
      }
    },
  };
}

export type WorkerOnboardingService = ReturnType<typeof createWorkerOnboardingService>;
