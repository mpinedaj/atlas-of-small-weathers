import { describe, expect, it } from 'vitest';

import { urlWithParam } from '../../src/ui/url';

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
