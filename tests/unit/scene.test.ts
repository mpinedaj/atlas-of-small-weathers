import { describe, expect, it } from 'vitest';

import type { PaletteContext, WeatherSnapshot } from '../../src/core/types';
import { offlineSnapshot } from '../../src/data';
import { simulationSize } from '../../src/gl/fluid';
import { createHouseScene, housePalette } from '../../src/gl/scene';
import { DEFAULT_SHADERS } from '../../src/gl/shaders/defaults';

const context: PaletteContext = {
  condition: 'clear',
  isDay: true,
  warmth: 0,
  humidity: 0.4,
  cloud: 0.2,
  pressure: 0.2,
  rain: 0,
  seed: 1844,
};

const snapshot: WeatherSnapshot = { ...offlineSnapshot, warmth: 0, isDay: true };

const HEX = /^#[0-9a-f]{6}$/;

describe('house palette', () => {
  it('returns six valid washes, ordered light to dark', () => {
    const palette = housePalette(snapshot, context);

    expect(palette.washes).toHaveLength(6);
    for (const colour of [palette.ground, palette.ink, palette.accent, palette.highlight]) {
      expect(colour).toMatch(HEX);
    }
    for (const wash of palette.washes) expect(wash).toMatch(HEX);

    const channel = (hex: string): number => parseInt(hex.slice(1, 3), 16);
    expect(channel(palette.washes[0]!)).toBeGreaterThan(channel(palette.washes[5]!));
  });

  it('warms the washes when the weather is warmer than the season', () => {
    const cold = housePalette({ ...snapshot, isDay: false }, { ...context, warmth: -1 });
    const warm = housePalette(snapshot, { ...context, warmth: 1 });

    const red = (hex: string): number => parseInt(hex.slice(1, 3), 16);
    const warmthOf = (washes: readonly string[]): number =>
      washes.reduce((total, hex) => total + red(hex), 0) / washes.length;

    expect(warmthOf(warm.washes)).toBeGreaterThan(warmthOf(cold.washes));
  });

  it('desaturates toward storm grey as rain and cloud increase', () => {
    const clear = housePalette(snapshot, context);
    const storm = housePalette(
      { ...snapshot, condition: 'storm' },
      { ...context, condition: 'storm', rain: 1, cloud: 1 },
    );

    const spread = (hex: string): number => {
      const values = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      return Math.max(...values) - Math.min(...values);
    };

    expect(spread(storm.washes[2]!)).toBeLessThanOrEqual(spread(clear.washes[2]!));
  });
});

describe('house scene', () => {
  it('resolves weather into a complete painting scene', () => {
    const scene = createHouseScene(offlineSnapshot, 1844);

    expect(scene.schoolId).toBe('house');
    expect(scene.seed).toBe(1844);
    expect(scene.condition).toBe(offlineSnapshot.condition);
    expect(scene.shaders).toEqual(DEFAULT_SHADERS);
    expect(scene.gestures.windVector).toHaveLength(2);
    for (const value of Object.values(scene.gestures)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe('fluid resolution', () => {
  it('scales with the canvas but caps the long edge', () => {
    const small = simulationSize(800, 600, 0.3);
    const large = simulationSize(3840, 2160, 0.3);

    expect(small.width).toBeGreaterThan(100);
    expect(small.height).toBeGreaterThan(100);
    expect(Math.max(large.width, large.height)).toBeLessThanOrEqual(448);
    expect(large.width / large.height).toBeCloseTo(3840 / 2160, 1);
  });

  it('never returns a zero-sized simulation', () => {
    const tiny = simulationSize(1, 1, 0.1);
    expect(tiny.width).toBeGreaterThanOrEqual(64);
    expect(tiny.height).toBeGreaterThanOrEqual(64);
  });
});
