import { afterEach, describe, expect, it, vi } from 'vitest';

import geocoding from '../../src/data/fixtures/bogota-geocoding.json';
import { createMemoryStorage, WeatherCache } from '../../src/data/cache';
import { normaliseQuery, offlinePlaces, searchPlaces } from '../../src/data/geocoding';

function makeCache() {
  return new WeatherCache({ storage: createMemoryStorage(), now: () => 1_000_000 });
}

function okResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normaliseQuery', () => {
  it('ignores accents, case and extra spaces', () => {
    expect(normaliseQuery('  Bogotá  ')).toBe('bogota');
    expect(normaliseQuery('Reykjavík')).toBe('reykjavik');
  });
});

describe('offlinePlaces', () => {
  it('finds curated cities without a network', () => {
    const places = offlinePlaces('bog');
    expect(places.map((place) => place.name)).toContain('Bogotá');
  });

  it('is accent-insensitive', () => {
    expect(offlinePlaces('reykjavik').map((place) => place.name)).toContain('Reykjavík');
  });

  it('searches countries and regions too', () => {
    expect(offlinePlaces('japan').map((place) => place.name)).toContain('Kyoto');
  });

  it('needs at least two characters', () => {
    expect(offlinePlaces('b')).toEqual([]);
    expect(offlinePlaces('   ')).toEqual([]);
  });
});

describe('searchPlaces', () => {
  it('returns curated matches and says they are offline', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPlaces('lisbon', { offline: true, cache: makeCache() });
    expect(result.places[0]?.country).toBe('Portugal');
    expect(result.source).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches, parses and then caches live results', async () => {
    const fetchMock = vi.fn(async () => okResponse(geocoding));
    vi.stubGlobal('fetch', fetchMock);
    const cache = makeCache();

    const first = await searchPlaces('bogota', { cache });
    expect(first.places).toHaveLength(2);
    expect(first.places[0]?.name).toBe('Bogotá');
    expect(first.source).toBe('live');

    const second = await searchPlaces('bogota', { cache });
    expect(second.places).toHaveLength(2);
    expect(second.source).toBe('cache');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to curated places, labelled offline, when the geocoder is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    const result = await searchPlaces('cape town', { cache: makeCache() });
    expect(result.places[0]?.name).toBe('Cape Town');
    expect(result.source).toBe('offline');
  });

  it('returns no places for a query that is too short', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPlaces('a', { cache: makeCache() });
    expect(result.places).toEqual([]);
    expect(result.source).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
