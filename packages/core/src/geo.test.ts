import { describe, expect, it } from 'vitest';
import {
  destinationPoint,
  EARTH_MEAN_RADIUS_M,
  haversineDistanceM,
  randomPointWithin,
  type LngLat,
} from './geo';

// Synthetic test origins only; not real places.
const EQUATOR: LngLat = { lng: 0, lat: 0 };
const MID: LngLat = { lng: 20, lat: 30 };

/** Small deterministic LCG so tests do not depend on Math.random. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('destinationPoint', () => {
  it('returns the origin for zero distance', () => {
    const p = destinationPoint(MID, 123, 0);
    expect(p.lat).toBeCloseTo(MID.lat, 12);
    expect(p.lng).toBeCloseTo(MID.lng, 12);
  });

  it('moves due north by d / R radians', () => {
    const d = 10_000;
    const p = destinationPoint(EQUATOR, 0, d);
    expect(p.lat).toBeCloseTo((d / EARTH_MEAN_RADIUS_M) * (180 / Math.PI), 10);
    expect(p.lng).toBeCloseTo(0, 10);
  });

  it('moves east when the bearing is 90 and west when 270', () => {
    expect(destinationPoint(MID, 90, 5000).lng).toBeGreaterThan(MID.lng);
    expect(destinationPoint(MID, 270, 5000).lng).toBeLessThan(MID.lng);
    expect(destinationPoint(MID, 180, 5000).lat).toBeLessThan(MID.lat);
  });

  it('round-trips with haversine distance across bearings and distances', () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const d of [1, 250, 4000, 50_000]) {
        const p = destinationPoint(MID, bearing, d);
        expect(haversineDistanceM(MID, p)).toBeCloseTo(d, 3);
      }
    }
  });

  it('normalises longitude across the antimeridian', () => {
    const p = destinationPoint({ lng: 179.99, lat: 0 }, 90, 10_000);
    expect(p.lng).toBeLessThan(-179);
    expect(p.lng).toBeGreaterThanOrEqual(-180);
  });

  it('rejects invalid input', () => {
    expect(() => destinationPoint({ lng: 0, lat: 91 }, 0, 1)).toThrow(RangeError);
    expect(() => destinationPoint({ lng: 181, lat: 0 }, 0, 1)).toThrow(RangeError);
    expect(() => destinationPoint({ lng: Number.NaN, lat: 0 }, 0, 1)).toThrow(RangeError);
    expect(() => destinationPoint(MID, 0, -1)).toThrow(RangeError);
    expect(() => destinationPoint(MID, Number.POSITIVE_INFINITY, 1)).toThrow(RangeError);
  });
});

describe('haversineDistanceM', () => {
  it('is zero for identical points and symmetric', () => {
    const other: LngLat = { lng: 21, lat: 31 };
    expect(haversineDistanceM(MID, MID)).toBe(0);
    expect(haversineDistanceM(MID, other)).toBeCloseTo(haversineDistanceM(other, MID), 9);
  });

  it('measures a quarter meridian as pi/2 * R', () => {
    expect(haversineDistanceM(EQUATOR, { lng: 0, lat: 90 })).toBeCloseTo(
      (Math.PI / 2) * EARTH_MEAN_RADIUS_M,
      3,
    );
  });
});

describe('randomPointWithin', () => {
  it('always stays inside the radius', () => {
    const random = lcg(42);
    for (let i = 0; i < 1000; i++) {
      const p = randomPointWithin(MID, 4000, random);
      expect(haversineDistanceM(MID, p)).toBeLessThanOrEqual(4000 + 1e-6);
    }
  });

  it('is deterministic for the same generator seed', () => {
    const a = randomPointWithin(MID, 4000, lcg(7));
    const b = randomPointWithin(MID, 4000, lcg(7));
    expect(a).toEqual(b);
  });

  it('spreads points over the disk area (about a quarter inside half the radius)', () => {
    const random = lcg(1);
    let inner = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      if (haversineDistanceM(MID, randomPointWithin(MID, 4000, random)) < 2000) inner++;
    }
    expect(inner / n).toBeGreaterThan(0.22);
    expect(inner / n).toBeLessThan(0.28);
  });

  it('rejects a negative radius', () => {
    expect(() => randomPointWithin(MID, -1, lcg(1))).toThrow(RangeError);
  });
});
