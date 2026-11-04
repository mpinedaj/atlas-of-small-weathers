import type { WeatherSnapshot } from '../core/types';
import type { WeatherCache } from './cache';
import { weatherCache } from './cache';
import { OFFLINE_NOTE, offlineSnapshot } from './fixtures';
import { WeatherError, fetchForecast } from './openMeteo';
import type { Place } from './places';

/** Current conditions are fresh for ten minutes. */
export const WEATHER_TTL_MS = 10 * 60 * 1000;

export type WeatherSource = 'live' | 'cache' | 'stale' | 'offline';

export interface WeatherResult {
  readonly snapshot: WeatherSnapshot;
  readonly source: WeatherSource;
  /** Present only for the offline sample, in plain language. */
  readonly note?: string;
}

export interface LoadWeatherOptions {
  /** Skip the network entirely and paint the recorded sample. */
  readonly offline?: boolean;
  readonly signal?: AbortSignal;
  readonly cache?: WeatherCache;
  /**
   * Paint the recorded sample when neither the network nor the cache can
   * answer. Defaults to true so the opening screen always has something to
   * show. An explicit place change passes false, because turning a missing
   * reading for Kyoto into a painting of Bogotá would be a lie.
   */
  readonly fallbackToSample?: boolean;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Weather is shared by everything within roughly a hundred metres. */
export function weatherCacheKey(place: Place): string {
  return `weather:${place.latitude.toFixed(3)}:${place.longitude.toFixed(3)}:${slug(place.name)}`;
}

function sample(): WeatherResult {
  return { snapshot: offlineSnapshot, source: 'offline', note: OFFLINE_NOTE };
}

function unavailable(place: Place, cause?: unknown): WeatherError {
  return new WeatherError(
    'unavailable',
    `No weather is available for ${place.name}`,
    cause === undefined ? undefined : { cause },
  );
}

/**
 * Load the weather for a place.
 *
 * The order is deliberate: a fresh cache entry avoids a request; the network is
 * preferred over an old entry; an old entry is better than a lie; and the
 * recorded sample is better than an empty canvas. An aborted request is never
 * treated as a failure, so a fast typist does not get the offline painting.
 */
export async function loadWeather(
  place: Place,
  options: LoadWeatherOptions = {},
): Promise<WeatherResult> {
  const cache = options.cache ?? weatherCache;
  const key = weatherCacheKey(place);
  const hit = cache.read<WeatherSnapshot>(key);

  if (options.offline) {
    if (hit) return { snapshot: hit.value, source: hit.fresh ? 'cache' : 'stale' };
    if (options.fallbackToSample === false) throw unavailable(place);
    return sample();
  }

  if (hit?.fresh) return { snapshot: hit.value, source: 'cache' };

  try {
    const snapshot = await fetchForecast(place, options.signal);
    cache.write(key, snapshot, WEATHER_TTL_MS);
    return { snapshot, source: 'live' };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (hit) return { snapshot: hit.value, source: 'stale' };
    if (options.fallbackToSample === false) {
      throw error instanceof WeatherError ? error : unavailable(place, error);
    }
    return sample();
  }
}
