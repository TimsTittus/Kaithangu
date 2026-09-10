import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { quote, type PricingStateConfig, type QuoteInput, type TradeRates } from './pricing';

// Test fixtures only (not real rates): round numbers chosen so results can be
// computed by hand.
const RATES: TradeRates = {
  wageFloorPerHourPaise: 10000,
  minBillableMinutes: 60,
  visitChargePaise: 5000,
  emergencySurchargePct: '25.00',
};
const CONFIG: PricingStateConfig = {
  welfarePct: '5.00',
  platformFeePct: '5.00',
  gstPctOnPlatformFee: '18.00',
};

function input(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    rates: RATES,
    stateConfig: CONFIG,
    estimatedMinutes: 50,
    urgency: 'normal',
    isInstitution: false,
    ...overrides,
  };
}

describe('quote (hand-computed)', () => {
  it('normal, below the minimum: billed at min_billable_minutes', () => {
    // wage = ceil(60 × 10000 / 60) + 5000 = 15000; welfare = fee = 750
    expect(quote(input())).toEqual({
      billableMinutes: 60,
      wage: 15000,
      surcharge: 0,
      welfare: 750,
      platformFee: 750,
      gst: 0,
      total: 16500,
      breakdownKeys: ['pricing.wage', 'pricing.welfare', 'pricing.platform_fee'],
    });
  });

  it('emergency: 25% surcharge on the wage, welfare/fee on the surcharged wage', () => {
    // surcharge = 3750; wage = 18750; welfare = fee = round(937.5) = 938
    expect(quote(input({ urgency: 'emergency' }))).toEqual({
      billableMinutes: 60,
      wage: 18750,
      surcharge: 3750,
      welfare: 938,
      platformFee: 938,
      gst: 0,
      total: 20626,
      breakdownKeys: [
        'pricing.wage',
        'pricing.emergency_surcharge',
        'pricing.welfare',
        'pricing.platform_fee',
      ],
    });
  });

  it('institution: GST on the platform fee only', () => {
    // gst = round(938 × 18 / 100 = 168.84) = 169
    const q = quote(input({ urgency: 'emergency', isInstitution: true }));
    expect(q.gst).toBe(169);
    expect(q.total).toBe(18750 + 938 + 938 + 169);
    expect(q.breakdownKeys).toEqual([
      'pricing.wage',
      'pricing.emergency_surcharge',
      'pricing.welfare',
      'pricing.platform_fee',
      'pricing.gst',
    ]);
  });

  it('above the minimum: time wage is rounded up to the paisa', () => {
    // ceil(95 × 10000 / 60 = 15833.33) = 15834; + 5000 = 20834; round(1041.7) = 1042
    const q = quote(input({ estimatedMinutes: 95 }));
    expect(q).toMatchObject({ billableMinutes: 95, wage: 20834, welfare: 1042, platformFee: 1042 });
    expect(q.total).toBe(22918);
  });

  it('odd rates and fractional percentages', () => {
    // billable 30; ceil(30 × 12345 / 60 = 6172.5) = 6173; surcharge round(771.625) = 772;
    // wage 6945; welfare round(173.625) = 174; fee round(538.2375) = 538; gst round(96.84) = 97
    const q = quote({
      rates: {
        wageFloorPerHourPaise: 12345,
        minBillableMinutes: 30,
        visitChargePaise: 0,
        emergencySurchargePct: 12.5,
      },
      stateConfig: { welfarePct: 2.5, platformFeePct: '7.75', gstPctOnPlatformFee: 18 },
      estimatedMinutes: 7,
      urgency: 'emergency',
      isInstitution: true,
    });
    expect(q).toMatchObject({
      billableMinutes: 30,
      wage: 6945,
      surcharge: 772,
      welfare: 174,
      platformFee: 538,
      gst: 97,
      total: 7754,
    });
  });

  it('rejects invalid inputs', () => {
    expect(() => quote(input({ estimatedMinutes: 0 }))).toThrow(RangeError);
    expect(() => quote(input({ estimatedMinutes: 1.5 }))).toThrow(RangeError);
    expect(() => quote(input({ rates: { ...RATES, minBillableMinutes: 0 } }))).toThrow(RangeError);
    expect(() => quote(input({ rates: { ...RATES, wageFloorPerHourPaise: 0 } }))).toThrow(
      RangeError,
    );
    expect(() => quote(input({ rates: { ...RATES, visitChargePaise: -1 } }))).toThrow(RangeError);
    expect(() => quote(input({ stateConfig: { ...CONFIG, welfarePct: '-5' } }))).toThrow(
      RangeError,
    );
  });
});

const pct = fc.integer({ min: 0, max: 10000 }).map((bps) => bps / 100);
const arbInput: fc.Arbitrary<QuoteInput> = fc.record({
  rates: fc.record({
    wageFloorPerHourPaise: fc.integer({ min: 1, max: 1_000_000 }),
    minBillableMinutes: fc.integer({ min: 1, max: 480 }),
    visitChargePaise: fc.integer({ min: 0, max: 1_000_000 }),
    emergencySurchargePct: pct,
  }),
  stateConfig: fc.record({ welfarePct: pct, platformFeePct: pct, gstPctOnPlatformFee: pct }),
  estimatedMinutes: fc.integer({ min: 1, max: 1440 }),
  urgency: fc.constantFrom('normal' as const, 'emergency' as const),
  isInstitution: fc.boolean(),
});

describe('quote (properties)', () => {
  it('parts sum to the total and are all non-negative', () => {
    fc.assert(
      fc.property(arbInput, (i) => {
        const q = quote(i);
        expect(q.wage + q.welfare + q.platformFee + q.gst).toBe(q.total);
        for (const part of [q.wage, q.surcharge, q.welfare, q.platformFee, q.gst, q.total]) {
          expect(Number.isSafeInteger(part)).toBe(true);
          expect(part).toBeGreaterThanOrEqual(0);
        }
        expect(q.wage).toBeGreaterThan(0);
        expect(q.surcharge).toBeLessThanOrEqual(q.wage);
        if (!i.isInstitution) expect(q.gst).toBe(0);
        if (i.urgency === 'normal') expect(q.surcharge).toBe(0);
      }),
    );
  });

  it('emergency total >= normal total', () => {
    fc.assert(
      fc.property(arbInput, (i) => {
        const normal = quote({ ...i, urgency: 'normal' });
        const emergency = quote({ ...i, urgency: 'emergency' });
        expect(emergency.total).toBeGreaterThanOrEqual(normal.total);
        expect(emergency.wage).toBeGreaterThanOrEqual(normal.wage);
      }),
    );
  });

  it('is monotonic in estimated minutes', () => {
    fc.assert(
      fc.property(arbInput, fc.integer({ min: 0, max: 600 }), (i, extra) => {
        const shorter = quote(i);
        const longer = quote({ ...i, estimatedMinutes: i.estimatedMinutes + extra });
        expect(longer.total).toBeGreaterThanOrEqual(shorter.total);
        expect(longer.wage).toBeGreaterThanOrEqual(shorter.wage);
      }),
    );
  });
});
