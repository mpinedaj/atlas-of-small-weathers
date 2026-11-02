import { describe, expect, it } from 'vitest';

import { createRandom, deriveSeed, hashString, normaliseSeed } from '../../src/core/seed';

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('turner:1844')).toBe(hashString('turner:1844'));
  });

  it('differs for different input', () => {
    expect(hashString('turner:1844')).not.toBe(hashString('turner:1845'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const value = hashString('a much longer string with spaces and punctuation!');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('normaliseSeed', () => {
  it('passes positive integers through', () => {
    expect(normaliseSeed(1844)).toBe(1844);
  });

  it('handles negative and fractional seeds', () => {
    expect(normaliseSeed(-42.7)).toBe(42);
  });

  it('falls back to the house seed for invalid input', () => {
    expect(normaliseSeed(Number.NaN)).toBe(1844);
    expect(normaliseSeed(Number.POSITIVE_INFINITY)).toBe(1844);
    expect(normaliseSeed(0)).toBe(1844);
  });
});

describe('createRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRandom(1844);
    const b = createRandom(1844);
    const first = Array.from({ length: 8 }, () => a());
    const second = Array.from({ length: 8 }, () => b());
    expect(first).toEqual(second);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRandom(1844);
    const b = createRandom(1845);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays inside the unit interval', () => {
    const random = createRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('generates integers inside an inclusive range', () => {
    const random = createRandom(7);
    for (let i = 0; i < 500; i += 1) {
      const value = random.int(2, 5);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('refuses to pick from an empty list', () => {
    const random = createRandom(7);
    expect(() => random.pick([])).toThrow(/empty/);
  });
});

describe('deriveSeed', () => {
  it('is deterministic and stable', () => {
    expect(deriveSeed(1844, 'rain')).toBe(deriveSeed(1844, 'rain'));
    expect(deriveSeed(1844, 'rain')).not.toBe(deriveSeed(1844, 'wind'));
  });

  it('always returns a usable positive seed', () => {
    for (const label of ['', 'turner', 'a'.repeat(500)]) {
      const value = deriveSeed(1844, label);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(0xffffff);
    }
  });
});
