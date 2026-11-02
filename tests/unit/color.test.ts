import { describe, expect, it } from 'vitest';

import { hexToRgb, luminance, mixRgb, toCss } from '../../src/gl/color';

describe('hexToRgb', () => {
  it('parses six digit hex', () => {
    const [r, g, b] = hexToRgb('#efe7d9');
    expect(r).toBeCloseTo(239 / 255, 6);
    expect(g).toBeCloseTo(231 / 255, 6);
    expect(b).toBeCloseTo(217 / 255, 6);
  });

  it('parses three digit hex', () => {
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
  });

  it('forgives a missing hash and whitespace', () => {
    expect(hexToRgb('  a9472b ')).toEqual(hexToRgb('#a9472b'));
  });

  it('falls back to black for nonsense', () => {
    expect(hexToRgb('not a colour')).toEqual([0, 0, 0]);
    expect(hexToRgb('#12345')).toEqual([0, 0, 0]);
  });
});

describe('mixRgb', () => {
  it('returns the endpoints and the midpoint', () => {
    expect(mixRgb([0, 0, 0], [1, 1, 1], 0)).toEqual([0, 0, 0]);
    expect(mixRgb([0, 0, 0], [1, 1, 1], 1)).toEqual([1, 1, 1]);
    expect(mixRgb([0, 0, 0], [1, 1, 1], 0.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('clamps outside the unit interval', () => {
    expect(mixRgb([0, 0, 0], [1, 1, 1], -1)).toEqual([0, 0, 0]);
    expect(mixRgb([0, 0, 0], [1, 1, 1], 2)).toEqual([1, 1, 1]);
  });
});

describe('luminance and CSS', () => {
  it('knows black from white', () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([1, 1, 1])).toBeCloseTo(1, 5);
  });

  it('formats a CSS colour', () => {
    expect(toCss([1, 0, 0])).toBe('rgb(255 0 0)');
  });
});
