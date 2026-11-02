import { describe, expect, it } from 'vitest';

import { CACHE_NAMESPACE, WeatherCache, createMemoryStorage } from '../../src/data/cache';

function makeCache(start = 1_000_000) {
  let now = start;
  const storage = createMemoryStorage();
  const cache = new WeatherCache({ storage, now: () => now });
  return {
    cache,
    storage,
    advance(ms: number) {
      now += ms;
    },
    get now() {
      return now;
    },
  };
}

describe('WeatherCache', () => {
  it('misses when nothing has been written', () => {
    const { cache } = makeCache();
    expect(cache.read('weather:bogota')).toBeNull();
  });

  it('returns a fresh hit with its age', () => {
    const { cache, advance } = makeCache();
    cache.write('weather:bogota', { temperatureC: 14.2 }, 10 * 60 * 1000);
    advance(60_000);

    const hit = cache.read<{ temperatureC: number }>('weather:bogota');
    expect(hit?.value).toEqual({ temperatureC: 14.2 });
    expect(hit?.ageMs).toBe(60_000);
    expect(hit?.fresh).toBe(true);
  });

  it('keeps stale entries available for an honest fallback', () => {
    const { cache, advance } = makeCache();
    cache.write('weather:bogota', { temperatureC: 14.2 }, 1000);
    advance(1001);

    const hit = cache.read('weather:bogota');
    expect(hit?.fresh).toBe(false);
    expect(hit?.value).toEqual({ temperatureC: 14.2 });
  });

  it('separates entries by namespace', () => {
    const storage = createMemoryStorage();
    const a = new WeatherCache({ namespace: 'atlas:v1', storage });
    const b = new WeatherCache({ namespace: 'atlas:v2', storage });

    a.write('weather', 1, 1000);
    expect(b.read('weather')).toBeNull();
    expect(a.key('weather')).toBe('atlas:v1:weather');
    expect(a.key('weather').startsWith(CACHE_NAMESPACE)).toBe(true);
  });

  it('ignores corrupted storage instead of throwing', () => {
    const { cache, storage } = makeCache();
    storage.setItem(cache.key('weather'), '{not json');

    expect(cache.read('weather')).toBeNull();
    expect(storage.getItem(cache.key('weather'))).toBeNull();
  });

  it('rejects entries from an older schema', () => {
    const { cache, storage } = makeCache();
    storage.setItem(cache.key('weather'), JSON.stringify({ v: 0, value: 3 }));

    expect(cache.read('weather')).toBeNull();
  });
});
