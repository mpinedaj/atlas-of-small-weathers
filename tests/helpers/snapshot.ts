import type { WeatherSnapshot } from '../../src/core/types';

/** A complete, valid reading for tests that care about one field at a time. */
export function makeWeather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    city: 'Bogotá',
    country: 'Colombia',
    admin1: 'Bogotá D.C.',
    latitude: 4.6097,
    longitude: -74.0817,
    elevationM: 2640,
    timezone: 'America/Bogota',
    observedAt: '2026-11-02T12:45',
    temperatureC: 14.2,
    apparentTemperatureC: 13.6,
    humidity: 82,
    cloudCover: 88,
    pressureHpa: 1012.4,
    precipitationMm: 0.4,
    windSpeedKmh: 9.7,
    windDirectionDeg: 134,
    isDay: true,
    weatherCode: 61,
    condition: 'rain',
    description: 'Light rain',
    baselineTemperatureC: 14,
    warmth: 0.03,
    ...overrides,
  };
}
