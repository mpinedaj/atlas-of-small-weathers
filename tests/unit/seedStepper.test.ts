import { describe, expect, it } from 'vitest';

import { normaliseSeed } from '../../src/core/seed';
import { stepSeed } from '../../src/ui/seed';

describe('stepSeed', () => {
  it('moves one seed at a time', () => {
    expect(stepSeed(1844, 1)).toBe(1845);
    expect(stepSeed(1844, -1)).toBe(1843);
  });

  it('moves ten seeds for a shifted step', () => {
    expect(stepSeed(1844, 10)).toBe(1854);
    expect(stepSeed(1844, -10)).toBe(1834);
  });

  it('never falls below one', () => {
    expect(stepSeed(1, -1)).toBe(1);
    expect(stepSeed(4, -10)).toBe(1);
  });

  it('wraps past the largest seed instead of overflowing', () => {
    expect(stepSeed(0xfffffffe, 1)).toBe(1);
  });

  it('normalises the seed it starts from', () => {
    expect(stepSeed(1844.9, 1)).toBe(normaliseSeed(1844.9) + 1);
    expect(stepSeed(0, 0)).toBe(normaliseSeed(0));
  });
});
