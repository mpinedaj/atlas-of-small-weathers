import type { WeatherSnapshot } from '../core/types';
import { baselineTemperatureC, warmthAnomaly } from './baseline';
import type { Place } from './places';
import { describeWeatherCode } from './wmo';

/**
 * Open-Meteo client.
 *
 * The network is the least reliable part of the painting. All parsing is pure
 * and exported so it can be tested against recorded fixtures, and every failure
 * becomes a typed error the interface can explain without leaking a stack trace.
 */

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
] as const;

const REQUEST_TIMEOUT_MS = 9_000;

export type WeatherErrorCode = 'network' | 'timeout' | 'http' | 'parse' | 'empty' | 'unavailable';

export class WeatherError extends Error {
  readonly code: WeatherErrorCode;

  constructor(code: WeatherErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WeatherError';
    this.code = code;
  }
}

export function forecastUrl(place: Place): string {
  const url = new URL(FORECAST_ENDPOINT);
  url.searchParams.set('latitude', place.latitude.toFixed(4));
  url.searchParams.set('longitude', place.longitude.toFixed(4));
  url.searchParams.set('current', CURRENT_FIELDS.join(','));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');
  return url.toString();
}

export function geocodingUrl(query: string, count = 8): string {
  const url = new URL(GEOCODING_ENDPOINT);
  url.searchParams.set('name', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function numberField(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Turn a forecast response into the one reading the painting understands.
 *
 * Open-Meteo already returns timezone-local times, so `observedAt` is not a UTC
 * instant; it is the wall clock of the place, which is what a weather label
 * should show.
 */
export function parseForecast(payload: unknown, place: Place): WeatherSnapshot {
  const root = asRecord(payload);
  const current = root ? asRecord(root['current']) : null;
  if (!root || !current) {
    throw new WeatherError('parse', 'Open-Meteo did not return current weather');
  }

  const observedAt = stringField(current, 'time');
  if (!observedAt) {
    throw new WeatherError('parse', 'Open-Meteo returned weather without an observation time');
  }

  const latitude = numberField(root, 'latitude', place.latitude);
  const longitude = numberField(root, 'longitude', place.longitude);
  const elevationM = numberField(root, 'elevation', place.elevation ?? 0);
  const temperatureC = numberField(current, 'temperature_2m', 15);
  const weatherCode = numberField(current, 'weather_code', -1);
  const weather = describeWeatherCode(weatherCode);
  const baselineC = baselineTemperatureC(latitude, elevationM, observedAt);

  return {
    city: place.name,
    country: place.country,
    admin1: place.admin1,
    latitude,
    longitude,
    elevationM,
    timezone: stringField(root, 'timezone') ?? place.timezone ?? 'UTC',
    observedAt,
    temperatureC,
    apparentTemperatureC: numberField(current, 'apparent_temperature', temperatureC),
    humidity: clamp(numberField(current, 'relative_humidity_2m', 70), 0, 100),
    cloudCover: clamp(numberField(current, 'cloud_cover', 50), 0, 100),
    pressureHpa: numberField(current, 'pressure_msl', 1013.2),
    precipitationMm: Math.max(0, numberField(current, 'precipitation', 0)),
    windSpeedKmh: Math.max(0, numberField(current, 'wind_speed_10m', 0)),
    windDirectionDeg: normaliseDegrees(numberField(current, 'wind_direction_10m', 0)),
    isDay: numberField(current, 'is_day', 1) >= 0.5,
    weatherCode,
    condition: weather.condition,
    description: weather.description,
    baselineTemperatureC: round(baselineC, 1),
    warmth: round(warmthAnomaly(temperatureC, baselineC), 3),
  };
}

/** Parse the geocoder, ignoring entries that cannot be painted. */
export function parseGeocoding(payload: unknown): Place[] {
  const root = asRecord(payload);
  const results = root?.['results'];
  if (!Array.isArray(results)) return [];

  const places: Place[] = [];
  for (const item of results) {
    const record = asRecord(item);
    if (!record) continue;

    const name = stringField(record, 'name');
    const latitude = record['latitude'];
    const longitude = record['longitude'];
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    places.push({
      id: typeof record['id'] === 'number' ? record['id'] : undefined,
      name,
      country: stringField(record, 'country'),
      admin1: stringField(record, 'admin1'),
      latitude,
      longitude,
      timezone: stringField(record, 'timezone'),
      elevation: numberField(record, 'elevation', 0),
    });
  }
  return places;
}

async function requestJson(url: string, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) {
    throw new DOMException('The request was aborted', 'AbortError');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new WeatherError('http', `Open-Meteo replied with ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) {
      throw new WeatherError('timeout', 'Open-Meteo took too long to answer', { cause: error });
    }
    if (error instanceof WeatherError) throw error;
    throw new WeatherError('network', 'Could not reach Open-Meteo', { cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export async function fetchForecast(place: Place, signal?: AbortSignal): Promise<WeatherSnapshot> {
  const payload = await requestJson(forecastUrl(place), signal);
  return parseForecast(payload, place);
}

export async function fetchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const payload = await requestJson(geocodingUrl(trimmed), signal);
  return parseGeocoding(payload);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normaliseDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
