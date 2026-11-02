import { describe, expect, it } from 'vitest';

import {
  annualMeanTemperatureC,
  baselineTemperatureC,
  dayOfYear,
  seasonalAmplitudeC,
  warmthAnomaly,
} from '../../src/data/baseline';

describe('annualMeanTemperatureC', () => {
  it('is warmest at the equator and colder toward the poles', () => {
    expect(annualMeanTemperatureC(0)).toBeCloseTo(26.5, 5);
    expect(annualMeanTemperatureC(30)).toBeLessThan(annualMeanTemperatureC(0));
    expect(annualMeanTemperatureC(60)).toBeLessThan(annualMeanTemperatureC(30));
    expect(annualMeanTemperatureC(80)).toBeLessThan(annualMeanTemperatureC(60));
  });

  it('treats both hemispheres symmetrically', () => {
    expect(annualMeanTemperatureC(-40)).toBeCloseTo(annualMeanTemperatureC(40), 10);
  });

  it('clamps beyond the poles', () => {
    expect(annualMeanTemperatureC(120)).toBe(annualMeanTemperatureC(90));
  });
});

describe('seasonalAmplitudeC', () => {
  it('keeps the tropics nearly flat', () => {
    expect(seasonalAmplitudeC(5)).toBe(1.2);
    expect(seasonalAmplitudeC(15)).toBeLessThan(2);
  });

  it('gives mid and high latitudes a real summer and winter', () => {
    expect(seasonalAmplitudeC(50)).toBeGreaterThan(6);
    expect(seasonalAmplitudeC(80)).toBe(13);
  });
});

describe('baselineTemperatureC', () => {
  it('peaks in July in the north and in January in the south', () => {
    const northJuly = baselineTemperatureC(51, 0, '2026-07-25');
    const northJanuary = baselineTemperatureC(51, 0, '2026-01-25');
    expect(northJuly).toBeGreaterThan(northJanuary);

    const southJuly = baselineTemperatureC(-34, 0, '2026-07-25');
    const southJanuary = baselineTemperatureC(-34, 0, '2026-01-25');
    expect(southJanuary).toBeGreaterThan(southJuly);
  });

  it('cools with elevation at roughly 4.5 °C per kilometre', () => {
    const seaLevel = baselineTemperatureC(4.6, 0, '2026-11-02');
    const city = baselineTemperatureC(4.6, 1000, '2026-11-02');
    expect(seaLevel - city).toBeCloseTo(4.5, 1);
  });

  it('marks Bogotá as a mild afternoon rather than a polar one', () => {
    const baseline = baselineTemperatureC(4.625, 2557, '2026-11-02T12:45');
    expect(baseline).toBeGreaterThan(12);
    expect(baseline).toBeLessThan(17);
  });
});

describe('warmthAnomaly', () => {
  it('clamps to the unit interval', () => {
    expect(warmthAnomaly(30, 10)).toBe(1);
    expect(warmthAnomaly(-10, 20)).toBe(-1);
  });

  it('is zero at the seasonal norm', () => {
    expect(warmthAnomaly(14, 14)).toBe(0);
  });
});

describe('dayOfYear', () => {
  it('counts from one', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-12-31')).toBe(365);
    expect(dayOfYear('2024-12-31')).toBe(366);
  });

  it('accepts a full local timestamp', () => {
    expect(dayOfYear('2026-11-02T12:45')).toBe(306);
  });
});
