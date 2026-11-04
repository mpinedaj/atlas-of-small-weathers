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
 * Where a result set came from. The combobox says so in plain language: a
 * curated list is honest about being curated, and a cached list is labelled as
 * an earlier answer rather than passed off as live.
 */
export type PlaceSource = 'live' | 'cache' | 'offline';

export interface PlaceSearchResult {
  readonly places: readonly Place[];
  readonly source: PlaceSource;
}

/**
 * Search for a place, preferring live results but never leaving the interface
 * empty when the network is down or the user asked for the offline sample.
 */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {},
): Promise<PlaceSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { places: [], source: 'offline' };

  const normalised = normaliseQuery(trimmed);
  const cache = options.cache ?? weatherCache;
  const key = `geocode:${normalised}`;
  const hit = cache.read<Place[]>(key);

  if (options.offline) {
    const places = hit?.value ?? offlinePlaces(trimmed);
    return { places, source: hit ? 'cache' : 'offline' };
  }
  if (hit?.fresh) return { places: hit.value, source: 'cache' };

  try {
    const places = await fetchPlaces(trimmed, options.signal);
    if (places.length > 0) {
      cache.write(key, places, GEOCODING_TTL_MS);
      return { places: places.slice(0, MAX_RESULTS), source: 'live' };
    }
    return { places: offlinePlaces(trimmed), source: 'offline' };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (hit) return { places: hit.value, source: 'cache' };
    return { places: offlinePlaces(trimmed), source: 'offline' };
  }
}
