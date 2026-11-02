import type { WeatherCache } from './cache';
import { weatherCache } from './cache';
import { fetchPlaces } from './openMeteo';
import type { Place } from './places';
import { CURATED_PLACES } from './places';

/** Geocoding changes slowly; a day is a reasonable lifetime. */
export const GEOCODING_TTL_MS = 24 * 60 * 60 * 1000;

const MAX_RESULTS = 8;

/** Lowercase, accent-free form used for cache keys and offline matching. */
export function normaliseQuery(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function matches(place: Place, query: string): boolean {
  const haystack = normaliseQuery(
    [place.name, place.admin1, place.country].filter(Boolean).join(' '),
  );
  return haystack.includes(query);
}

/** Places we can still offer when the geocoder is unreachable. */
export function offlinePlaces(query: string): Place[] {
  const normalised = normaliseQuery(query);
  if (normalised.length < 2) return [];
  return CURATED_PLACES.filter((place) => matches(place, normalised)).slice(0, MAX_RESULTS);
}

export interface SearchOptions {
  readonly offline?: boolean;
  readonly signal?: AbortSignal;
  readonly cache?: WeatherCache;
}

/**
 * Search for a place, preferring live results but never leaving the interface
 * empty when the network is down or the user asked for the offline sample.
 */
export async function searchPlaces(query: string, options: SearchOptions = {}): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const normalised = normaliseQuery(trimmed);
  const cache = options.cache ?? weatherCache;
  const key = `geocode:${normalised}`;
  const hit = cache.read<Place[]>(key);

  if (options.offline) {
    return hit?.value ?? offlinePlaces(trimmed);
  }
  if (hit?.fresh) return hit.value;

  try {
    const places = await fetchPlaces(trimmed, options.signal);
    if (places.length > 0) {
      cache.write(key, places, GEOCODING_TTL_MS);
      return places.slice(0, MAX_RESULTS);
    }
    return offlinePlaces(trimmed);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (hit) return hit.value;
    return offlinePlaces(trimmed);
  }
}
