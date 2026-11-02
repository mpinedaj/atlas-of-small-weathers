import { describe, expect, it } from 'vitest';

import { describeWeatherCode } from '../../src/data/wmo';

describe('describeWeatherCode', () => {
  it.each([
    [0, 'clear'],
    [2, 'cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [51, 'rain'],
    [63, 'rain'],
    [71, 'snow'],
    [86, 'snow'],
    [95, 'storm'],
    [99, 'storm'],
  ] as const)('maps %i to %s', (code, condition) => {
    expect(describeWeatherCode(code).condition).toBe(condition);
  });

  it('gives every known code a human sentence', () => {
    for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 95, 99]) {
      const info = describeWeatherCode(code);
      expect(info.description.length).toBeGreaterThan(2);
      expect(info.description[0]).toBe(info.description[0]?.toUpperCase());
    }
  });

  it('falls back gracefully for unknown codes', () => {
    const info = describeWeatherCode(-1);
    expect(info.condition).toBe('cloudy');
    expect(info.description).toBe('Unsettled sky');
  });
});
