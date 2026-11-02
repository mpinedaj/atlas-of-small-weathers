import type { DataToGesture, GestureState, PaletteContext, WeatherSnapshot } from '../core/types';

/**
 * Weather becomes gesture.
 *
 * Every school inherits this mapping and may replace individual functions. The
 * output is normalised once, here, so shaders never see kilometres per hour or
 * hectopascals. The choices are deliberately legible:
 *
 *   temperature  -> warmth
 *   wind         -> speed, direction, tension and stroke length
 *   humidity     -> the veil
 *   cloud        -> mass in the upper field
 *   pressure     -> visual weight
 *   rain         -> grain and drip
 */

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const defaultMapping: DataToGesture = {
  warmth: (weather) => weather.warmth,

  windSpeed: (weather) => clamp01(weather.windSpeedKmh / 60),

  windDirection: (weather) => {
    // Meteorological direction is where the wind comes from. Paint where it goes.
    const towards = (weather.windDirectionDeg + 180) * (Math.PI / 180);
    return Math.atan2(Math.sin(towards), Math.cos(towards));
  },

  windVector: (weather) => {
    const towards = (weather.windDirectionDeg + 180) * (Math.PI / 180);
    return [Math.sin(towards), -Math.cos(towards)] as const;
  },

  tension: (weather) => {
    const wind = clamp01(weather.windSpeedKmh / 60);
    const dryness = 1 - clamp01(weather.humidity / 100);
    return clamp01(0.12 + wind * 0.68 + dryness * 0.2);
  },

  humidityVeil: (weather) => clamp01(weather.humidity / 100),

  cloudMass: (weather) => clamp01(weather.cloudCover / 100),

  pressureWeight: (weather) => clamp01((1015 - weather.pressureHpa) / 35),

  rainGrain: (weather) => {
    const rain = clamp01(weather.precipitationMm / 4);
    const storm = weather.condition === 'storm' ? 0.3 : 0;
    const wet = weather.condition === 'rain' ? 0.08 : 0;
    return clamp01(rain * 0.75 + storm + wet);
  },

  light: (weather) => {
    if (!weather.isDay) return 0.1;
    return clamp01(0.58 + (1 - weather.cloudCover / 100) * 0.42);
  },

  strokeLength: (weather) => clamp01(0.18 + clamp01(weather.windSpeedKmh / 55) * 0.78),
};

/** Merge a school's overrides over the default mapping. */
export function resolveMapping(overrides?: Partial<DataToGesture>): DataToGesture {
  return overrides ? { ...defaultMapping, ...overrides } : defaultMapping;
}

/** Evaluate a mapping for one reading. */
export function toGestureState(
  weather: WeatherSnapshot,
  mapping: DataToGesture = defaultMapping,
): GestureState {
  return {
    warmth: mapping.warmth(weather),
    windSpeed: mapping.windSpeed(weather),
    windDirection: mapping.windDirection(weather),
    windVector: mapping.windVector(weather),
    tension: mapping.tension(weather),
    humidityVeil: mapping.humidityVeil(weather),
    cloudMass: mapping.cloudMass(weather),
    pressureWeight: mapping.pressureWeight(weather),
    rainGrain: mapping.rainGrain(weather),
    light: mapping.light(weather),
    strokeLength: mapping.strokeLength(weather),
  };
}

/** The compact context a palette function receives. */
export function toPaletteContext(weather: WeatherSnapshot, seed: number): PaletteContext {
  return {
    condition: weather.condition,
    isDay: weather.isDay,
    warmth: weather.warmth,
    humidity: clamp01(weather.humidity / 100),
    cloud: clamp01(weather.cloudCover / 100),
    pressure: clamp01((1015 - weather.pressureHpa) / 35),
    rain: clamp01(weather.precipitationMm / 5),
    seed,
  };
}
