import { base, en, en_IN, Faker } from '@faker-js/faker';

/** Seed for every generated value, so two seeds of an empty DB are identical. */
export const SEED = 42;

/**
 * Fresh faker instance (Indian names, English fallback) seeded with `seed`.
 * Callers must draw values in a fixed order; nothing here reads the clock.
 */
export function createSeededFaker(seed: number = SEED): Faker {
  const faker = new Faker({ locale: [en_IN, en, base] });
  faker.seed(seed);
  return faker;
}

/** A [0, 1) generator backed by `faker`, for helpers that take `() => number`. */
export function unitRandom(faker: Faker): () => number {
  return () => faker.number.float({ min: 0, max: 1 - Number.EPSILON });
}
