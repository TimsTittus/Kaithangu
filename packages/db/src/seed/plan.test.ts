import { haversineDistanceM, type LngLat } from '@kaithangu/core';
import { describe, expect, it } from 'vitest';
import type { PincodeRow } from './pincodes';
import {
  DEMO_PHONES,
  pincodeCentroid,
  planKeypadDemoWorkers,
  planSocieties,
  planWorkers,
  workerPhone,
  WORKER_HOME_RADIUS_M,
  type SocietyPlan,
} from './plan';
import { createSeededFaker } from './random';

// Synthetic pincode rows; fictional coordinates, not real places.
function office(pincode: string, district: string, lat: number, lng: number): PincodeRow {
  return {
    pincode,
    officeName: `${pincode} BO`,
    district,
    stateName: 'TESTLAND',
    location: { lat, lng },
  };
}
const ROWS: PincodeRow[] = [
  office('600001', 'ERNAKULAM', 10.0, 20.0),
  office('600001', 'ERNAKULAM', 10.2, 20.2),
  office('600002', 'ERNAKULAM', 10.3, 20.1),
  office('600003', 'ERNAKULAM', 10.4, 20.3),
  office('600004', 'ERNAKULAM', 10.5, 20.4),
  office('600010', 'KOTTAYAM', 9.0, 21.0),
  office('600011', 'KOTTAYAM', 9.1, 21.1),
  office('600012', 'KOTTAYAM', 9.2, 21.2),
];

function plan(seed = 42) {
  const faker = createSeededFaker(seed);
  const societies = planSocieties(faker, ROWS);
  return { faker, societies, workers: planWorkers(faker, societies) };
}

describe('pincodeCentroid', () => {
  it('averages the office coordinates of a pincode', () => {
    const c = pincodeCentroid(ROWS, '600001');
    expect(c.lat).toBeCloseTo(10.1, 10);
    expect(c.lng).toBeCloseTo(20.1, 10);
  });

  it('refuses a pincode that is not in the data', () => {
    expect(() => pincodeCentroid(ROWS, '999999')).toThrow(/not in the imported table/);
  });
});

describe('planSocieties', () => {
  const { societies } = plan();

  it('places 3 Ernakulam and 2 Kottayam societies on distinct real pincodes', () => {
    expect(societies.map((s) => s.district)).toEqual([
      'ERNAKULAM',
      'ERNAKULAM',
      'ERNAKULAM',
      'KOTTAYAM',
      'KOTTAYAM',
    ]);
    expect(new Set(societies.map((s) => s.pincode)).size).toBe(5);
    for (const s of societies) {
      expect(s.location).toEqual(pincodeCentroid(ROWS, s.pincode));
      expect(s.name).toMatch(/\(Demo\)$/);
    }
  });

  it('fails when a district has too few pincodes', () => {
    expect(() => planSocieties(createSeededFaker(), ROWS.slice(0, 5))).toThrow(/KOTTAYAM/);
  });
});

describe('planWorkers', () => {
  const { societies, workers } = plan();

  it('creates 100 workers per society with unique E.164 phones', () => {
    expect(workers).toHaveLength(500);
    for (const s of societies) {
      expect(workers.filter((w) => w.societyId === s.id)).toHaveLength(100);
    }
    expect(new Set(workers.map((w) => w.phone)).size).toBe(500);
    expect(workers.every((w) => /^\+[1-9][0-9]{7,14}$/.test(w.phone))).toBe(true);
    const demoPhones: string[] = [DEMO_PHONES.customer, DEMO_PHONES.stateAdmin];
    expect(workers.some((w) => demoPhones.includes(w.phone))).toBe(false);
  });

  it('has exactly 30% keypad-only and 10% pending workers', () => {
    expect(workers.filter((w) => !w.hasSmartphone)).toHaveLength(150);
    expect(workers.filter((w) => w.status === 'pending')).toHaveLength(50);
    expect(workers.filter((w) => w.status === 'pending').some((w) => w.available)).toBe(false);
  });

  it('places every home within 4 km of its society', () => {
    const bySociety = new Map(societies.map((s): [string, SocietyPlan] => [s.id, s]));
    for (const w of workers) {
      const society = bySociety.get(w.societyId);
      expect(society).toBeDefined();
      if (society) {
        expect(haversineDistanceM(society.location, w.homeLocation)).toBeLessThanOrEqual(
          WORKER_HOME_RADIUS_M,
        );
      }
    }
  });

  it('gives valid skills and consistent ratings', () => {
    for (const w of workers) {
      expect(w.skills.length).toBeGreaterThanOrEqual(1);
      expect(new Set(w.skills.map((s) => s.tradeCode)).size).toBe(w.skills.length);
      for (const s of w.skills) {
        expect([1, 2, 3]).toContain(s.level);
        expect(s.years).toBeGreaterThanOrEqual(0);
        expect(s.verified).toBe(w.status === 'verified');
        if ((s.tradeCode === 'electrician' || s.tradeCode === 'technician') && s.verified) {
          expect(s.certified).toBe(true);
        }
      }
      expect(w.ratingSum).toBeGreaterThanOrEqual(w.ratingCount);
      expect(w.ratingSum).toBeLessThanOrEqual(5 * w.ratingCount);
    }
  });

  it('uses several trades', () => {
    const trades = new Set(workers.flatMap((w) => w.skills.map((s) => s.tradeCode)));
    expect(trades.size).toBe(10);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const again = plan(42);
    expect(again.workers[0]).toEqual(workers[0]);
    expect(again.societies).toEqual(societies);
    expect(plan(7).workers[0]?.userId).not.toBe(workers[0]?.userId);
  });
});

describe('planKeypadDemoWorkers', () => {
  it('seeds a verified plumber and certified electrician near the demo location', () => {
    const { faker, societies } = plan();
    const demo: LngLat = societies[3]?.location ?? { lat: 0, lng: 0 };
    const keypad = planKeypadDemoWorkers(faker, societies, demo, [
      '+919999900001',
      '+919999900002',
    ]);
    expect(keypad.map((w) => w.skills[0]?.tradeCode)).toEqual(['plumber', 'electrician']);
    expect(keypad.map((w) => w.phone)).toEqual(['+919999900001', '+919999900002']);
    for (const w of keypad) {
      expect(w.societyId).toBe(societies[3]?.id);
      expect(w.status).toBe('verified');
      expect(w.hasSmartphone).toBe(false);
      expect(w.available).toBe(true);
      expect(w.skills[0]?.certified).toBe(true);
      expect(haversineDistanceM(demo, w.homeLocation)).toBeLessThanOrEqual(1000);
    }
  });
});

describe('workerPhone', () => {
  it('formats the synthetic range and rejects out-of-range indexes', () => {
    expect(workerPhone(0)).toBe('+919000100000');
    expect(workerPhone(499)).toBe('+919000100499');
    expect(() => workerPhone(100_000)).toThrow(RangeError);
    expect(() => workerPhone(-1)).toThrow(RangeError);
  });
});
