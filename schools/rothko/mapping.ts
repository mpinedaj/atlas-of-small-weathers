import type { DataToGesture, WeatherSnapshot } from '../../src/core/types';

/**
 * Rothko's weather moves less than the weather itself.
 *
 * Wind still reaches the field, but only as a slow lean. Marks stay short and
 * soft, light stays low, and pressure floats rather than sinks. The painting is
 * a place to stand in front of, not a report to read.
 */

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const mapping: Partial<DataToGesture> = {
  tension: (weather: WeatherSnapshot) => clamp01(0.06 + clamp01(weather.windSpeedKmh / 120)),

  strokeLength: (weather: WeatherSnapshot) => clamp01(0.2 + clamp01(weather.windSpeedKmh / 240)),

  light: (weather: WeatherSnapshot) =>
    weather.isDay ? clamp01(0.42 + (1 - weather.cloudCover / 100) * 0.26) : 0.16,

  pressureWeight: (weather: WeatherSnapshot) => clamp01((1015 - weather.pressureHpa) / 80),
};

export default mapping;
