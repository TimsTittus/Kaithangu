import type { Faker } from '@faker-js/faker';
import {
  haversineDistanceM,
  isCertifiedRequired,
  randomPointWithin,
  type LngLat,
  type TradeCode,
} from '@kaithangu/core';
import type { PincodeRow } from './pincodes';
import { unitRandom } from './random';

// Demo data shape (Phase 2 spec). All generated entities are fictional.
export const DEMO_SOCIETY_DISTRICTS = [
  { district: 'ERNAKULAM', count: 3 },
  { district: 'KOTTAYAM', count: 2 },
] as const;
export const WORKERS_PER_SOCIETY = 100;
export const WORKER_HOME_RADIUS_M = 4000;
export const KEYPAD_ONLY_SHARE = 0.3;
export const PENDING_SHARE = 0.1;
export const AVAILABLE_SHARE_OF_VERIFIED = 0.6;
export const SECOND_TRADE_SHARE = 0.25;
export const DEMO_KEYPAD_HOME_RADIUS_M = 1000;

/** Fixed demo account phones (documented in docs/demo-accounts.md). */
export const DEMO_PHONES = {
  customer: '+919000000001',
  lcsAdmin: (societyIndex: number) => `+91900000001${societyIndex}`,
  stateAdmin: '+919000000020',
  nationalAdmin: '+919000000030',
  institutionAdmin: '+919000000040',
} as const;

/** Synthetic worker phones: +9190001 followed by five digits. */
export function workerPhone(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 99_999) {
    throw new RangeError(`worker index out of range: ${index}`);
  }
  return `+9190001${String(index).padStart(5, '0')}`;
}

// Illustrative demo proportions, not real labour-market statistics.
const TRADE_WEIGHTS: { value: TradeCode; weight: number }[] = [
  { value: 'domestic_help', weight: 18 },
  { value: 'cleaner', weight: 14 },
  { value: 'plumber', weight: 12 },
  { value: 'electrician', weight: 12 },
  { value: 'painter', weight: 9 },
  { value: 'carpenter', weight: 9 },
  { value: 'driver', weight: 8 },
  { value: 'gardener', weight: 7 },
  { value: 'caregiver', weight: 6 },
  { value: 'technician', weight: 5 },
];
const LEVEL_WEIGHTS: { value: 1 | 2 | 3; weight: number }[] = [
  { value: 1, weight: 35 },
  { value: 2, weight: 45 },
  { value: 3, weight: 20 },
];
const YEARS_BY_LEVEL = { 1: [0, 3], 2: [3, 10], 3: [8, 25] } as const;

export interface SocietyPlan {
  id: string;
  index: number;
  name: string;
  district: string;
  pincode: string;
  location: LngLat;
}

export interface SkillPlan {
  tradeCode: TradeCode;
  level: 1 | 2 | 3;
  years: number;
  certified: boolean;
  verified: boolean;
}

export interface WorkerPlan {
  userId: string;
  phone: string;
  name: string;
  societyId: string;
  status: 'verified' | 'pending';
  hasSmartphone: boolean;
  available: boolean;
  homeLocation: LngLat;
  ratingSum: number;
  ratingCount: number;
  skills: SkillPlan[];
}

/** Mean of a pincode's office coordinates (= ST_Centroid of the multipoint). */
export function pincodeCentroid(rows: readonly PincodeRow[], pincode: string): LngLat {
  const matches = rows.filter((r) => r.pincode === pincode);
  if (matches.length === 0) throw new Error(`pincode ${pincode} not in the imported table`);
  return {
    lat: matches.reduce((sum, r) => sum + r.location.lat, 0) / matches.length,
    lng: matches.reduce((sum, r) => sum + r.location.lng, 0) / matches.length,
  };
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Pick demo society pincodes per district from the imported data. */
export function planSocieties(faker: Faker, rows: readonly PincodeRow[]): SocietyPlan[] {
  const plans: SocietyPlan[] = [];
  for (const { district, count } of DEMO_SOCIETY_DISTRICTS) {
    const inDistrict = rows.filter((r) => r.district === district);
    const pincodes = [...new Set(inDistrict.map((r) => r.pincode))].sort();
    if (pincodes.length < count) {
      throw new Error(`need ${count} pincodes in ${district}, found ${pincodes.length}`);
    }
    for (const pincode of faker.helpers.arrayElements(pincodes, count)) {
      const index = plans.length;
      plans.push({
        id: faker.string.uuid(),
        index,
        name: `${titleCase(district)} Labour Cooperative Society ${index + 1} (Demo)`,
        district,
        pincode,
        location: pincodeCentroid(inDistrict, pincode),
      });
    }
  }
  return plans;
}

function planSkill(faker: Faker, tradeCode: TradeCode, verified: boolean): SkillPlan {
  const level = faker.helpers.weightedArrayElement(LEVEL_WEIGHTS);
  const [minYears, maxYears] = YEARS_BY_LEVEL[level];
  const certified = isCertifiedRequired(tradeCode)
    ? verified || faker.number.float({ min: 0, max: 1 }) < 0.5
    : faker.number.float({ min: 0, max: 1 }) < 0.2;
  return {
    tradeCode,
    level,
    years: faker.number.int({ min: minYears, max: maxYears }),
    certified,
    verified,
  };
}

/** Pick exactly round(total × share) distinct indexes. */
function pickIndexes(faker: Faker, total: number, share: number): Set<number> {
  const all = Array.from({ length: total }, (_, i) => i);
  return new Set(faker.helpers.shuffle(all).slice(0, Math.round(total * share)));
}

export function planWorkers(faker: Faker, societies: readonly SocietyPlan[]): WorkerPlan[] {
  const total = societies.length * WORKERS_PER_SOCIETY;
  const keypadOnly = pickIndexes(faker, total, KEYPAD_ONLY_SHARE);
  const pending = pickIndexes(faker, total, PENDING_SHARE);
  const random = unitRandom(faker);
  const workers: WorkerPlan[] = [];
  for (let i = 0; i < total; i++) {
    const society = societies[Math.floor(i / WORKERS_PER_SOCIETY)];
    if (!society) throw new Error(`no society for worker ${i}`);
    const verified = !pending.has(i);
    const primary = faker.helpers.weightedArrayElement(TRADE_WEIGHTS);
    const skills = [planSkill(faker, primary, verified)];
    if (faker.number.float({ min: 0, max: 1 }) < SECOND_TRADE_SHARE) {
      const others = TRADE_WEIGHTS.filter((t) => t.value !== primary);
      skills.push(planSkill(faker, faker.helpers.weightedArrayElement(others), verified));
    }
    const ratingCount = faker.number.int({ min: 0, max: 30 });
    const average = faker.number.float({ min: 3, max: 5 });
    workers.push({
      userId: faker.string.uuid(),
      phone: workerPhone(i),
      name: faker.person.fullName(),
      societyId: society.id,
      status: verified ? 'verified' : 'pending',
      hasSmartphone: !keypadOnly.has(i),
      available: verified && faker.number.float({ min: 0, max: 1 }) < AVAILABLE_SHARE_OF_VERIFIED,
      homeLocation: randomPointWithin(society.location, WORKER_HOME_RADIUS_M, random),
      ratingSum: Math.min(
        5 * ratingCount,
        Math.max(ratingCount, Math.round(ratingCount * average)),
      ),
      ratingCount,
      skills,
    });
  }
  return workers;
}

/**
 * The two physical keypad demo phones: a verified plumber and a verified,
 * certified electrician living near the demo location, attached to the nearest
 * demo society. Drawn after the main workers so env changes never shift them.
 */
export function planKeypadDemoWorkers(
  faker: Faker,
  societies: readonly SocietyPlan[],
  demoLocation: LngLat,
  phones: readonly [string, string],
): WorkerPlan[] {
  const nearest = [...societies].sort(
    (a, b) =>
      haversineDistanceM(a.location, demoLocation) - haversineDistanceM(b.location, demoLocation),
  )[0];
  if (!nearest) throw new Error('no demo societies planned');
  const random = unitRandom(faker);
  const trades: TradeCode[] = ['plumber', 'electrician'];
  return trades.map((tradeCode, i) => ({
    userId: faker.string.uuid(),
    phone: phones[i] ?? '',
    name: `${faker.person.firstName()} (Demo keypad ${tradeCode})`,
    societyId: nearest.id,
    status: 'verified' as const,
    hasSmartphone: false,
    available: true,
    homeLocation: randomPointWithin(demoLocation, DEMO_KEYPAD_HOME_RADIUS_M, random),
    ratingSum: 0,
    ratingCount: 0,
    skills: [{ tradeCode, level: 3, years: 10, certified: true, verified: true }],
  }));
}
