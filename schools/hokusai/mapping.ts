import type { DataToGesture, WeatherSnapshot } from '../../src/core/types';

/**
 * Hokusai's weather is drawn with a quick, certain hand.
 *
 * Wind lengthens every mark and pulls the sea sideways; rain becomes grain in
 * the block. The mapping is more emphatic than the house mapping because the
 * print depends on linework rather than on atmosphere.
 */

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const mapping: Partial<DataToGesture> = {
  tension: (weather: WeatherSnapshot) =>
    clamp01(
      0.3 + clamp01(weather.windSpeedKmh / 55) * 0.58 + clamp01(weather.precipitationMm / 6) * 0.2,
    ),

  strokeLength: (weather: WeatherSnapshot) =>
    clamp01(0.42 + clamp01(weather.windSpeedKmh / 45) * 0.55),

  cloudMass: (weather: WeatherSnapshot) => clamp01((weather.cloudCover / 100) * 1.18),

  rainGrain: (weather: WeatherSnapshot) =>
    clamp01(
      clamp01(weather.precipitationMm / 2.5) * 0.7 + (weather.condition === 'storm' ? 0.28 : 0),
    ),
};

export default mapping;
