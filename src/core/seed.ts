/**
 * Deterministic randomness.
 *
 * Every visual decision that can vary between runs is derived from the seed in
 * the URL. The same seed, city, school and time window must always produce the
 * same painting, frame for frame, on every machine. We therefore avoid
 * `Math.random()` in the render path entirely.
 */

/**
 * The seed of a first visit. 1844 is the year Turner first showed *Rain, Steam
 * and Speed*, the painting this engine keeps in the corner of its eye.
 */
export const DEFAULT_SEED = 1844;

/** Hash an arbitrary string into a 32-bit unsigned integer (xmur3). */
export function hashString(value: string): number {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Normalise anything into a positive 32-bit seed. */
export function normaliseSeed(seed: number): number {
  if (!Number.isFinite(seed)) return DEFAULT_SEED;
  const value = Math.floor(Math.abs(seed)) % 0xffffffff;
  return value === 0 ? DEFAULT_SEED : value;
}

/** A small, fast, seedable PRNG with a stable sequence across platforms. */
export interface Random {
  (): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
}

export function createRandom(seed: number): Random {
  let state = normaliseSeed(seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const random = next as Random;
  random.int = (min, max) => Math.floor(random.range(min, max + 1));
  random.range = (min, max) => min + random() * (max - min);
  random.pick = (items) => {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[Math.floor(random() * items.length)] as (typeof items)[number];
  };
  random.chance = (probability) => random() < probability;
  return random;
}

/** Advance a seed deterministically, e.g. when a new page of weather arrives. */
export function deriveSeed(seed: number, label: string): number {
  return (hashString(`${normaliseSeed(seed)}:${label}`) % 0xffffff) + 1;
}
