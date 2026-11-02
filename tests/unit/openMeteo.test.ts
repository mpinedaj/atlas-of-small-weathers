import { describe, expect, it } from 'vitest';

import forecast from '../../src/data/fixtures/bogota-forecast.json';
import geocoding from '../../src/data/fixtures/bogota-geocoding.json';
import { DEFAULT_PLACE } from '../../src/data/places';
import {
  WeatherError,
  forecastUrl,
  geocodingUrl,
  parseForecast,
  parseGeocoding,
} from '../../src/data/openMeteo';

describe('parseForecast', () => {
  it('turns a recorded response into a complete reading', () => {
    const snapshot = parseForecast(forecast, DEFAULT_PLACE);

    expect(snapshot.city).toBe('Bogotá');
    expect(snapshot.country).toBe('Colombia');
    expect(snapshot.timezone).toBe('America/Bogota');
    expect(snapshot.observedAt).toBe('2026-11-02T12:45');
    expect(snapshot.temperatureC).toBe(14.2);
    expect(snapshot.humidity).toBe(82);
    expect(snapshot.cloudCover).toBe(88);
    expect(snapshot.pressureHpa).toBe(1012.4);
    expect(snapshot.windDirectionDeg).toBe(134);
    expect(snapshot.elevationM).toBe(2557);
    expect(snapshot.isDay).toBe(true);
    expect(snapshot.weatherCode).toBe(61);
    expect(snapshot.condition).toBe('rain');
    expect(snapshot.description).toBe('Light rain');
  });

  it('derives a Bogotá afternoon as close to its seasonal norm', () => {
    const snapshot = parseForecast(forecast, DEFAULT_PLACE);
    expect(snapshot.baselineTemperatureC).toBeGreaterThan(12);
    expect(snapshot.baselineTemperatureC).toBeLessThan(17);
    expect(Math.abs(snapshot.warmth)).toBeLessThan(0.2);
  });

  it('refuses a response without current weather', () => {
    expect(() => parseForecast({}, DEFAULT_PLACE)).toThrow(WeatherError);
    try {
      parseForecast({}, DEFAULT_PLACE);
    } catch (error) {
      expect((error as WeatherError).code).toBe('parse');
    }
  });

  it('keeps a NaN out of the painting', () => {
    const broken = {
      ...forecast,
      current: { ...forecast.current, temperature_2m: null, wind_speed_10m: 'fast' },
    };
    const snapshot = parseForecast(broken, DEFAULT_PLACE);
    expect(Number.isFinite(snapshot.temperatureC)).toBe(true);
    expect(Number.isFinite(snapshot.windSpeedKmh)).toBe(true);
  });
});

describe('parseGeocoding', () => {
  it('keeps valid places and drops incomplete ones', () => {
    const places = parseGeocoding(geocoding);
    expect(places).toHaveLength(2);
    expect(places[0]?.name).toBe('Bogotá');
    expect(places[0]?.country).toBe('Colombia');
    expect(places[1]?.admin1).toBe('New Jersey');
  });

  it('returns an empty list for an empty response', () => {
    expect(parseGeocoding({})).toEqual([]);
    expect(parseGeocoding(null)).toEqual([]);
  });
});

describe('URL builders', () => {
  it('asks for exactly the current fields the painting reads', () => {
    const url = new URL(forecastUrl(DEFAULT_PLACE));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('4.6097');
    expect(url.searchParams.get('longitude')).toBe('-74.0817');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('current')).toContain('weather_code');
    expect(url.searchParams.get('current')).toContain('pressure_msl');
  });

  it('encodes the geocoding query and asks for English names', () => {
    const url = new URL(geocodingUrl('Bogotá'));
    expect(url.searchParams.get('name')).toBe('Bogotá');
    expect(url.searchParams.get('language')).toBe('en');
    expect(url.searchParams.get('count')).toBe('8');
  });
});
