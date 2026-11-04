import { afterEach, describe, expect, it, vi } from 'vitest';

import forecast from '../../src/data/fixtures/bogota-forecast.json';
import { createMemoryStorage, WeatherCache } from '../../src/data/cache';
import { DEFAULT_PLACE } from '../../src/data/places';
import { WEATHER_TTL_MS, loadWeather, weatherCacheKey } from '../../src/data/weather';
import { makeWeather } from '../helpers/snapshot';

function makeCache() {
  let now = 1_000_000;
  const cache = new WeatherCache({ storage: createMemoryStorage(), now: () => now });
  return {
    cache,
    advance(ms: number) {
      now += ms;
    },
  };
}

function okResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadWeather', () => {
  it('fetches once, then serves the fresh cache', async () => {
    const { cache, advance } = makeCache();
    const fetchMock = vi.fn(async () => okResponse(forecast));
    vi.stubGlobal('fetch', fetchMock);

    const live = await loadWeather(DEFAULT_PLACE, { cache });
    expect(live.source).toBe('live');
    expect(live.snapshot.condition).toBe('rain');

    advance(60_000);
    const cached = await loadWeather(DEFAULT_PLACE, { cache });
    expect(cached.source).toBe('cache');
    expect(cached.snapshot.temperatureC).toBe(14.2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches after the ten minute lifetime', async () => {
    const { cache, advance } = makeCache();
    const fetchMock = vi.fn(async () => okResponse(forecast));
    vi.stubGlobal('fetch', fetchMock);

    await loadWeather(DEFAULT_PLACE, { cache });
    advance(WEATHER_TTL_MS + 1);
    const second = await loadWeather(DEFAULT_PLACE, { cache });

    expect(second.source).toBe('live');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to a stale reading when the network fails', async () => {
    const { cache, advance } = makeCache();
    cache.write(weatherCacheKey(DEFAULT_PLACE), makeWeather({ temperatureC: 9 }), 1000);
    advance(5000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    const result = await loadWeather(DEFAULT_PLACE, { cache });
    expect(result.source).toBe('stale');
    expect(result.snapshot.temperatureC).toBe(9);
  });

  it('paints the recorded sample when there is no network and no cache', async () => {
    const { cache } = makeCache();
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadWeather(DEFAULT_PLACE, { cache });
    expect(result.source).toBe('offline');
    expect(result.snapshot.city).toBe('Bogotá');
    expect(result.note).toContain('Offline sample');
  });

  it('never touches the network in offline mode', async () => {
    const { cache } = makeCache();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadWeather(DEFAULT_PLACE, { cache, offline: true });
    expect(result.source).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prefers a cached reading over the sample in offline mode', async () => {
    const { cache } = makeCache();
    cache.write(
      weatherCacheKey(DEFAULT_PLACE),
      makeWeather({ city: 'Cached Bogotá' }),
      WEATHER_TTL_MS,
    );

    const result = await loadWeather(DEFAULT_PLACE, { cache, offline: true });
    expect(result.source).toBe('cache');
    expect(result.snapshot.city).toBe('Cached Bogotá');
  });

  it('does not turn an aborted request into an offline painting', async () => {
    const { cache } = makeCache();
    const controller = new AbortController();
    controller.abort();

    await expect(
      loadWeather(DEFAULT_PLACE, { cache, signal: controller.signal }),
    ).rejects.toThrow();
  });

  it('refuses to paint Bogotá for an explicit place with no reading', async () => {
    const { cache } = makeCache();
    const kyoto = { name: 'Kyoto', latitude: 35.0116, longitude: 135.7681 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    await expect(loadWeather(kyoto, { cache, fallbackToSample: false })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('refuses the sample for an explicit place in offline mode too', async () => {
    const { cache } = makeCache();
    const kyoto = { name: 'Kyoto', latitude: 35.0116, longitude: 135.7681 };

    await expect(
      loadWeather(kyoto, { cache, offline: true, fallbackToSample: false }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('still serves a cached reading for an explicit place when the network is down', async () => {
    const { cache, advance } = makeCache();
    const kyoto = { name: 'Kyoto', latitude: 35.0116, longitude: 135.7681 };
    cache.write(weatherCacheKey(kyoto), makeWeather({ city: 'Kyoto' }), 1000);
    advance(5000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    const result = await loadWeather(kyoto, { cache, fallbackToSample: false });
    expect(result.source).toBe('stale');
    expect(result.snapshot.city).toBe('Kyoto');
  });

  it('keys the cache by rounded coordinates and place name', () => {
    const key = weatherCacheKey(DEFAULT_PLACE);
    expect(key).toBe('weather:4.610:-74.082:bogota');
  });
});
