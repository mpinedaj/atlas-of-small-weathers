import { describe, expect, it } from 'vitest';

import {
  defaultMapping,
  resolveMapping,
  toGestureState,
  toPaletteContext,
} from '../../src/data/gestures';
import { makeWeather } from '../helpers/snapshot';

describe('defaultMapping', () => {
  it('maps wind from the north to a vector travelling south', () => {
    const gestures = toGestureState(makeWeather({ windDirectionDeg: 0 }));
    expect(gestures.windVector[0]).toBeCloseTo(0, 6);
    expect(gestures.windVector[1]).toBeCloseTo(1, 6);
  });

  it('maps wind from the east to a vector travelling west', () => {
    const gestures = toGestureState(makeWeather({ windDirectionDeg: 90 }));
    expect(gestures.windVector[0]).toBeCloseTo(-1, 6);
    expect(gestures.windVector[1]).toBeCloseTo(0, 6);
  });

  it('normalises wind speed and stroke length to the unit interval', () => {
    const calm = toGestureState(makeWeather({ windSpeedKmh: 0 }));
    const gale = toGestureState(makeWeather({ windSpeedKmh: 120 }));
    expect(calm.windSpeed).toBe(0);
    expect(gale.windSpeed).toBe(1);
    expect(gale.strokeLength).toBeGreaterThan(calm.strokeLength);
    expect(gale.tension).toBeGreaterThan(calm.tension);
  });

  it('treats low pressure as visual weight', () => {
    expect(toGestureState(makeWeather({ pressureHpa: 1015 })).pressureWeight).toBe(0);
    expect(toGestureState(makeWeather({ pressureHpa: 980 })).pressureWeight).toBe(1);
  });

  it('turns rain and storms into grain', () => {
    const drizzle = toGestureState(makeWeather({ precipitationMm: 0, condition: 'rain' }));
    const downpour = toGestureState(makeWeather({ precipitationMm: 4, condition: 'rain' }));
    const storm = toGestureState(makeWeather({ precipitationMm: 0, condition: 'storm' }));
    expect(downpour.rainGrain).toBeGreaterThan(drizzle.rainGrain);
    expect(storm.rainGrain).toBeGreaterThan(0);
  });

  it('paints night darker than day', () => {
    const day = toGestureState(makeWeather({ isDay: true, cloudCover: 0 }));
    const night = toGestureState(makeWeather({ isDay: false, cloudCover: 0 }));
    expect(day.light).toBe(1);
    expect(night.light).toBeLessThan(0.2);
  });

  it('keeps warmth relative to the baseline', () => {
    expect(toGestureState(makeWeather({ warmth: -0.7 })).warmth).toBe(-0.7);
  });

  it('lets a school replace one gesture and inherit the rest', () => {
    const mapping = resolveMapping({ tension: () => 0.91 });
    const gestures = toGestureState(makeWeather(), mapping);
    expect(gestures.tension).toBe(0.91);
    expect(gestures.cloudMass).toBeCloseTo(0.88, 5);
    expect(mapping.warmth).toBe(defaultMapping.warmth);
  });
});

describe('toPaletteContext', () => {
  it('compacts the reading into 0…1 values', () => {
    const context = toPaletteContext(makeWeather(), 1844);
    expect(context.seed).toBe(1844);
    expect(context.humidity).toBeCloseTo(0.82, 5);
    expect(context.cloud).toBeCloseTo(0.88, 5);
    expect(context.rain).toBeCloseTo(0.08, 5);
    expect(context.condition).toBe('rain');
  });
});
