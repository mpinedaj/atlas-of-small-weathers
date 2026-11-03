import type { DataToGesture, WeatherSnapshot } from '../../src/core/types';

/**
 * A few Turner-specific readings of weather.
 *
 * The defaults are already legible. These overrides push the school toward
 * longer weather: wind matters more than drizzle for the length of a stroke,
 * cloud weighs more, and pressure drops the eye toward the water.
 */

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const mapping: Partial<DataToGesture> = {
  tension: (weather: WeatherSnapshot) =>
    clamp01(
      0.18 +
        clamp01(weather.windSpeedKmh / 60) * 0.58 +
        clamp01(weather.precipitationMm / 8) * 0.24,
    ),

  strokeLength: (weather: WeatherSnapshot) =>
    clamp01(0.28 + clamp01(weather.windSpeedKmh / 55) * 0.68),

  cloudMass: (weather: WeatherSnapshot) => clamp01((weather.cloudCover / 100) * 1.12),

  light: (weather: WeatherSnapshot) =>
    weather.isDay ? clamp01(0.55 + (1 - weather.cloudCover / 100) * 0.5) : 0.12,

  pressureWeight: (weather: WeatherSnapshot) => clamp01((1015 - weather.pressureHpa) / 30),
};

export default mapping;
