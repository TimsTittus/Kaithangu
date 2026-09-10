import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EMERGENCY_WEIGHTS,
  fairnessBoost,
  NORMAL_WEIGHTS,
  rankCandidates,
  scoreCandidate,
  type MatchCandidate,
  type MatchContext,
} from './score';

const CONTEXT: MatchContext = { societyMeanRating: 4, medianEarnings30dPaise: 10000 };

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    workerId: 'w-1',
    distanceKm: 2,
    serviceRadiusKm: 8,
    skillLevel: 2,
    ratingSum: 18,
    ratingCount: 4,
    earnings30dPaise: 5000,
    lastJobCompletedAt: null,
    ...overrides,
  };
}

describe('scoreCandidate: components', () => {
  it('proximity is 1 at 0 km, 0 at the radius and clamped to 0 beyond it', () => {
    const at = (distanceKm: number) =>
      scoreCandidate(candidate({ distanceKm }), CONTEXT, 'normal').breakdown.proximity;
    expect(at(0)).toBe(1);
    expect(at(4)).toBe(0.5);
    expect(at(8)).toBe(0);
    expect(at(20)).toBe(0);
  });

  it('skill fit is level / 3', () => {
    for (const skillLevel of [1, 2, 3]) {
      const { breakdown } = scoreCandidate(candidate({ skillLevel }), CONTEXT, 'normal');
      expect(breakdown.skillFit).toBe(skillLevel / 3);
    }
  });

  it('bayesian rating falls back to the society mean with 0 ratings', () => {
    const { breakdown } = scoreCandidate(
      candidate({ ratingSum: 0, ratingCount: 0 }),
      { ...CONTEXT, societyMeanRating: 3.6 },
      'normal',
    );
    expect(breakdown.bayesianRating).toBeCloseTo(3.6, 12);
    expect(breakdown.ratingNorm).toBeCloseTo(0.65, 12);
  });

  it('bayesian rating shrinks the worker mean towards the society mean', () => {
    // (5 × 4 + 18) / (5 + 4) = 38 / 9
    const { breakdown } = scoreCandidate(candidate(), CONTEXT, 'normal');
    expect(breakdown.bayesianRating).toBeCloseTo(38 / 9, 12);
    expect(breakdown.ratingNorm).toBeCloseTo((38 / 9 - 1) / 4, 12);
  });

  it('fairness boost when the median is 0 depends only on whether the worker earned', () => {
    expect(fairnessBoost(0, 0)).toBe(1);
    expect(fairnessBoost(500, 0)).toBe(0);
  });

  it('fairness boost is the clamped shortfall from the median otherwise', () => {
    expect(fairnessBoost(0, 10000)).toBe(1);
    expect(fairnessBoost(5000, 10000)).toBe(0.5);
    expect(fairnessBoost(10000, 10000)).toBe(0);
    expect(fairnessBoost(30000, 10000)).toBe(0);
  });
});

describe('scoreCandidate: weights', () => {
  it('normal score is 0.35·p + 0.25·s + 0.15·r + 0.25·f', () => {
    const { score, breakdown } = scoreCandidate(candidate(), CONTEXT, 'normal');
    const expected = 0.35 * 0.75 + 0.25 * (2 / 3) + 0.15 * ((38 / 9 - 1) / 4) + 0.25 * 0.5;
    expect(score).toBeCloseTo(expected, 12);
    expect(breakdown.weights).toEqual(NORMAL_WEIGHTS);
    expect(breakdown.fairnessBoost).toBe(0.5);
  });

  it.each(['emergency', 'disaster'] as const)(
    '%s score is 0.70·p + 0.20·s + 0.10·r and ignores fairness',
    (mode) => {
      const { score, breakdown } = scoreCandidate(candidate(), CONTEXT, mode);
      expect(score).toBeCloseTo(0.7 * 0.75 + 0.2 * (2 / 3) + 0.1 * ((38 / 9 - 1) / 4), 12);
      expect(breakdown.weights).toEqual(EMERGENCY_WEIGHTS);
      expect(breakdown.contributions.fairness).toBe(0);
      for (const earnings30dPaise of [0, 10000, 999999]) {
        expect(scoreCandidate(candidate({ earnings30dPaise }), CONTEXT, mode).score).toBe(score);
      }
    },
  );

  it('weights sum to 1 in every mode', () => {
    for (const w of [NORMAL_WEIGHTS, EMERGENCY_WEIGHTS]) {
      expect(w.proximity + w.skill + w.rating + w.fairness).toBeCloseTo(1, 12);
    }
  });

  it('scores stay within [0, 1] (property)', () => {
    const arbCandidate = fc
      .record({
        distanceKm: fc.double({ min: 0, max: 50, noNaN: true }),
        serviceRadiusKm: fc.double({ min: 0.5, max: 30, noNaN: true }),
        skillLevel: fc.integer({ min: 1, max: 3 }),
        ratingCount: fc.integer({ min: 0, max: 500 }),
        starsFraction: fc.double({ min: 0, max: 1, noNaN: true }),
        earnings30dPaise: fc.integer({ min: 0, max: 10_000_000 }),
      })
      .map(({ starsFraction, ...rest }) =>
        candidate({
          ...rest,
          ratingSum: rest.ratingCount + Math.floor(starsFraction * 4 * rest.ratingCount),
        }),
      );
    const arbContext = fc.record({
      societyMeanRating: fc.double({ min: 1, max: 5, noNaN: true }),
      medianEarnings30dPaise: fc.integer({ min: 0, max: 10_000_000 }),
    });
    fc.assert(
      fc.property(
        arbCandidate,
        arbContext,
        fc.constantFrom('normal' as const, 'emergency' as const, 'disaster' as const),
        (c, ctx, mode) => {
          const { score } = scoreCandidate(c, ctx, mode);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1 + 1e-12);
        },
      ),
    );
  });
});

describe('scoreCandidate: explanation', () => {
  it('names the factor with the largest weighted contribution', () => {
    expect(scoreCandidate(candidate({ distanceKm: 0 }), CONTEXT, 'normal').explanation).toEqual({
      key: 'matching.why.proximity',
      params: { distanceKm: 0, skillLevel: 2, rating: 4.2 },
    });
    const far = candidate({ distanceKm: 8, skillLevel: 3, earnings30dPaise: 5000 });
    expect(scoreCandidate(far, CONTEXT, 'normal').explanation.key).toBe('matching.why.skill');
    const idle = candidate({ distanceKm: 8, skillLevel: 1, earnings30dPaise: 0 });
    expect(scoreCandidate(idle, CONTEXT, 'normal').explanation.key).toBe('matching.why.fairness');
    const rated = candidate({ distanceKm: 8, skillLevel: 1, earnings30dPaise: 10000 });
    expect(scoreCandidate(rated, CONTEXT, 'normal').explanation.key).toBe('matching.why.rating');
  });

  it('rounds display params to one decimal', () => {
    const { params } = scoreCandidate(
      candidate({ distanceKm: 2.345 }),
      CONTEXT,
      'normal',
    ).explanation;
    expect(params.distanceKm).toBe(2.3);
  });
});

describe('scoreCandidate: validation', () => {
  it.each([
    { distanceKm: -1 },
    { distanceKm: Number.NaN },
    { serviceRadiusKm: 0 },
    { skillLevel: 0 },
    { skillLevel: 4 },
    { skillLevel: 1.5 },
    { ratingCount: -1 },
    { ratingCount: 2, ratingSum: 1 },
    { ratingCount: 2, ratingSum: 11 },
    { earnings30dPaise: -1 },
    { lastJobCompletedAt: new Date('not a date') },
  ])('rejects %o', (overrides) => {
    expect(() => scoreCandidate(candidate(overrides), CONTEXT, 'normal')).toThrow(RangeError);
  });

  it('rejects an out-of-range context', () => {
    expect(() =>
      scoreCandidate(candidate(), { ...CONTEXT, societyMeanRating: 0.5 }, 'normal'),
    ).toThrow(RangeError);
    expect(() =>
      scoreCandidate(candidate(), { ...CONTEXT, medianEarnings30dPaise: -1 }, 'normal'),
    ).toThrow(RangeError);
  });
});

describe('rankCandidates', () => {
  it('orders by score, best first, with 1-based ranks', () => {
    const ranked = rankCandidates(
      [
        candidate({ workerId: 'far', distanceKm: 7 }),
        candidate({ workerId: 'near', distanceKm: 0.5 }),
        candidate({ workerId: 'mid', distanceKm: 4 }),
      ],
      CONTEXT,
      'normal',
    );
    expect(ranked.map((r) => [r.candidate.workerId, r.rank])).toEqual([
      ['near', 1],
      ['mid', 2],
      ['far', 3],
    ]);
  });

  it('breaks score ties by oldest last job (null first), then worker id', () => {
    const tied = [
      candidate({ workerId: 'd', lastJobCompletedAt: new Date('2026-09-01T00:00:00Z') }),
      candidate({ workerId: 'c', lastJobCompletedAt: new Date('2026-08-01T00:00:00Z') }),
      candidate({ workerId: 'b', lastJobCompletedAt: null }),
      candidate({ workerId: 'a', lastJobCompletedAt: new Date('2026-08-01T00:00:00Z') }),
      candidate({ workerId: 'e', lastJobCompletedAt: null }),
    ];
    const expected = ['b', 'e', 'a', 'c', 'd'];
    expect(rankCandidates(tied, CONTEXT, 'normal').map((r) => r.candidate.workerId)).toEqual(
      expected,
    );
    // Deterministic regardless of input order.
    expect(
      rankCandidates([...tied].reverse(), CONTEXT, 'normal').map((r) => r.candidate.workerId),
    ).toEqual(expected);
  });

  it('does not mutate the input and handles an empty list', () => {
    const input = [candidate({ workerId: 'x', distanceKm: 6 }), candidate({ workerId: 'y' })];
    rankCandidates(input, CONTEXT, 'normal');
    expect(input.map((c) => c.workerId)).toEqual(['x', 'y']);
    expect(rankCandidates([], CONTEXT, 'normal')).toEqual([]);
  });
});
