import { describe, expect, it } from 'vitest';

import { canonicalShareUrl, readUrlState, urlWithParam, urlWithState } from '../../src/ui/url';

const BASE = 'https://atlas.test/?city=Bogot%C3%A1&seed=1844&school=turner&still=1';

describe('urlWithParam', () => {
  it('replaces an existing parameter and keeps the rest', () => {
    const result = new URL(urlWithParam(BASE, 'school', 'hokusai'));

    expect(result.searchParams.get('school')).toBe('hokusai');
    expect(result.searchParams.get('city')).toBe('Bogotá');
    expect(result.searchParams.get('seed')).toBe('1844');
    expect(result.searchParams.get('still')).toBe('1');
  });

  it('adds a parameter that is not present', () => {
    const result = new URL(urlWithParam(BASE, 'mode', 'still'));

    expect(result.searchParams.get('mode')).toBe('still');
  });

  it('removes a parameter when the value is empty or null', () => {
    for (const value of [null, '', '   ']) {
      const result = new URL(urlWithParam(BASE, 'school', value));

      expect(result.searchParams.has('school')).toBe(false);
      expect(result.searchParams.get('city')).toBe('Bogotá');
    }
  });

  it('trims the value and does not duplicate the parameter', () => {
    const result = new URL(urlWithParam(BASE, 'school', '  rothko  '));

    expect(result.searchParams.getAll('school')).toEqual(['rothko']);
  });

  it('leaves the hash untouched', () => {
    const result = new URL(urlWithParam(`${BASE}#painting`, 'school', 'rothko'));

    expect(result.hash).toBe('#painting');
  });
});

describe('readUrlState', () => {
  it('reads a complete painting and ignores out-of-range coordinates', () => {
    const state = readUrlState(
      '?city=Kyoto&lat=35.0116&lon=135.7681&school=rothko&seed=77&mode=still&offline=1&warmup=90',
    );

    expect(state).toMatchObject({
      city: 'Kyoto',
      latitude: 35.0116,
      longitude: 135.7681,
      school: 'rothko',
      seed: 77,
      mode: 'still',
      offline: true,
      warmupFrames: 90,
    });
  });

  it('keeps still=1 as an alias for the older links', () => {
    expect(readUrlState('?still=1').mode).toBe('still');
    expect(readUrlState('?still=0').mode).toBe('still');
    expect(readUrlState('').mode).toBe('live');
  });

  it('rejects incomplete or nonsensical values', () => {
    const state = readUrlState('?lat=200&lon=-400&seed=nope&warmup=-2');

    expect(state.latitude).toBeNull();
    expect(state.longitude).toBeNull();
    expect(state.seed).toBeNull();
    expect(state.warmupFrames).toBeNull();
  });
});

describe('urlWithState', () => {
  const state = {
    place: { name: 'Kyoto', latitude: 35.0116, longitude: 135.7681 },
    school: 'rothko',
    seed: 88,
    mode: 'still' as const,
  };

  it('writes every value that defines the painting and removes the still alias', () => {
    const url = new URL(urlWithState('https://atlas.test/?still=1&offline=1&warmup=90', state));

    expect(url.searchParams.get('city')).toBe('Kyoto');
    expect(url.searchParams.get('lat')).toBe('35.0116');
    expect(url.searchParams.get('lon')).toBe('135.7681');
    expect(url.searchParams.get('school')).toBe('rothko');
    expect(url.searchParams.get('seed')).toBe('88');
    expect(url.searchParams.get('mode')).toBe('still');
    expect(url.searchParams.has('still')).toBe(false);
    expect(url.searchParams.get('offline')).toBe('1');
    expect(url.searchParams.get('warmup')).toBe('90');
  });

  it('removes the school when the house scene is active', () => {
    const url = new URL(
      urlWithState('https://atlas.test/?school=turner', {
        ...state,
        school: null,
      }),
    );

    expect(url.searchParams.has('school')).toBe(false);
  });
});

describe('canonicalShareUrl', () => {
  const state = {
    place: { name: 'Bogotá', latitude: 4.6097, longitude: -74.0817 },
    school: 'turner',
    seed: 1844,
    mode: 'live' as const,
  };

  it('drops test switches and the hash', () => {
    const url = new URL(
      canonicalShareUrl('https://atlas.test/?offline=1&warmup=90&still=1&debug=1#painting', state),
    );

    expect(url.searchParams.has('offline')).toBe(false);
    expect(url.searchParams.has('warmup')).toBe(false);
    expect(url.searchParams.has('still')).toBe(false);
    expect(url.searchParams.has('debug')).toBe(false);
    expect(url.hash).toBe('');
    expect(url.searchParams.get('city')).toBe('Bogotá');
    expect(url.searchParams.get('mode')).toBe('live');
  });

  it('round-trips through readUrlState exactly', () => {
    const share = canonicalShareUrl('https://atlas.test/', state);
    const restored = readUrlState(new URL(share).search);

    expect(restored.city).toBe('Bogotá');
    expect(restored.latitude).toBe(4.6097);
    expect(restored.longitude).toBe(-74.0817);
    expect(restored.school).toBe('turner');
    expect(restored.seed).toBe(1844);
    expect(restored.mode).toBe('live');
  });
});
