import { describe, expect, it } from 'vitest';

import type { Condition, WeatherSnapshot } from '../../src/core/types';
import { offlineSnapshot } from '../../src/data';
import { createScene } from '../../src/gl/scene';
import { buildFragment } from '../../src/gl/shaders/common';
import { DEFAULT_SHADERS } from '../../src/gl/shaders/defaults';
import {
  SchoolValidationError,
  defaultSchool,
  discoverSchools,
  findSchool,
  getSchools,
  parseSchoolMeta,
} from '../../src/schools/registry';

const discovery = getSchools();
const turner = findSchool(discovery.schools, 'turner');
const conditions: readonly Condition[] = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];
const HEX = /^#[0-9a-f]{6}$/;

function issuesOf(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SchoolValidationError);
    return (error as SchoolValidationError).issues;
  }
  throw new Error('Expected a SchoolValidationError.');
}

const validMeta = {
  id: 'test-school',
  name: 'Test School',
  author: 'A Painter',
  license: 'MIT',
  description: 'A school used only by the tests.',
  references: ['A reference'],
  version: '0.1.0',
};

describe('school discovery', () => {
  it('finds the Turner school without a hand-written registry', () => {
    expect(discovery.errors).toEqual([]);
    expect(turner).toBeDefined();
    expect(turner?.meta.id).toBe('turner');
    expect(turner?.meta.name).toBe('Turner');
    expect(turner?.directory).toBe('schools/turner');
    expect(turner?.meta.references.length).toBeGreaterThanOrEqual(2);
    expect(typeof turner?.palette).toBe('function');
  });

  it('opens with Turner when it exists, and degrades to the first school', () => {
    expect(defaultSchool(discovery.schools)?.meta.id).toBe('turner');
    expect(defaultSchool([])).toBeUndefined();
    expect(defaultSchool([turner!])?.meta.id).toBe('turner');
  });

  it('resolves a school from a URL value and ignores unknown ids', () => {
    expect(findSchool(discovery.schools, 'turner')).toBe(turner);
    expect(findSchool(discovery.schools, 'not-a-school')).toBeUndefined();
    expect(findSchool(discovery.schools, null)).toBeUndefined();
  });

  it('reports malformed folders through discoverSchools without throwing', () => {
    const result = discoverSchools();

    expect(Array.isArray(result.schools)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    for (const error of result.errors) {
      expect(error.path.startsWith('schools/')).toBe(true);
      expect(error.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('school metadata validation', () => {
  it('accepts a complete document and strips unknown keys', () => {
    const meta = parseSchoolMeta({ ...validMeta, futureField: 'ignored' }, 'test-school');

    expect(meta).toEqual(validMeta);
    expect('futureField' in meta).toBe(false);
  });

  it('rejects a document that is not an object', () => {
    expect(issuesOf(() => parseSchoolMeta('turner'))).toContain(
      'The document must be a JSON object.',
    );
  });

  it('collects every missing or invalid field', () => {
    const issues = issuesOf(() =>
      parseSchoolMeta(
        {
          id: 'Not Valid',
          name: '',
          author: 'A',
          license: 'MIT',
          description: '',
          references: [],
          version: 'one',
        },
        'something-else',
      ),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        '"id" must be lowercase letters, digits and hyphens.',
        '"id" must match its folder name ("something-else").',
        '"name" must be a non-empty string.',
        '"description" must be a non-empty string.',
        '"references" must be a non-empty array of strings.',
        '"version" must be a semantic version, e.g. "0.1.0".',
      ]),
    );
  });

  it('rejects non-string references and more than six of them', () => {
    expect(
      issuesOf(() => parseSchoolMeta({ ...validMeta, references: ['ok', 42] }, validMeta.id)),
    ).toContain('"references" must contain only non-empty strings.');

    expect(
      issuesOf(() =>
        parseSchoolMeta(
          {
            ...validMeta,
            references: ['1', '2', '3', '4', '5', '6', '7'],
          },
          validMeta.id,
        ),
      ),
    ).toContain('"references" may contain at most six entries.');
  });
});

describe('Turner palette', () => {
  it('returns a complete, valid palette for every weather condition', () => {
    for (const condition of conditions) {
      const palette = turner!.palette(
        { ...offlineSnapshot, condition },
        {
          condition,
          isDay: true,
          warmth: 0,
          humidity: 0.5,
          cloud: 0.5,
          pressure: 0.5,
          rain: 0.25,
          seed: 1844,
        },
      );

      expect(palette.washes).toHaveLength(6);
      for (const colour of [
        palette.ground,
        palette.ink,
        palette.accent,
        palette.highlight,
        palette.shadow,
        ...palette.washes,
      ]) {
        expect(colour).toMatch(HEX);
      }
    }
  });

  it('moves toward ochre when warmer than the season and slate when colder', () => {
    const context = {
      condition: 'clear' as const,
      isDay: true,
      humidity: 0.4,
      cloud: 0.1,
      pressure: 0.2,
      rain: 0,
      seed: 1844,
    };
    const warm = turner!.palette({ ...offlineSnapshot, warmth: 1 }, { ...context, warmth: 1 });
    const cold = turner!.palette({ ...offlineSnapshot, warmth: -1 }, { ...context, warmth: -1 });

    const red = (hex: string): number => parseInt(hex.slice(1, 3), 16);
    const meanRed = (washes: readonly string[]): number =>
      washes.reduce((total, colour) => total + red(colour), 0) / washes.length;

    expect(meanRed(warm.washes)).toBeGreaterThan(meanRed(cold.washes));
    expect(red(warm.accent)).toBeGreaterThan(red(cold.accent));
  });
});

describe('Turner scene', () => {
  const scene = createScene(offlineSnapshot, 1844, turner);

  it('uses the school identity, palette and mapping', () => {
    expect(scene.schoolId).toBe('turner');
    expect(scene.schoolName).toBe('Turner');
    expect(scene.seed).toBe(1844);
    expect(scene.palette.washes).toHaveLength(6);

    for (const value of Object.values(scene.gestures)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('overlays the school shaders over the house shaders slot by slot', () => {
    for (const slot of ['field', 'flow', 'brush', 'post'] as const) {
      expect(scene.shaders[slot]).not.toBe(DEFAULT_SHADERS[slot]);
      expect(scene.shaders[slot].trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every Turner shader body inside the shared shader contract', () => {
    for (const slot of ['field', 'flow', 'brush', 'post'] as const) {
      const body = scene.shaders[slot];
      const source = buildFragment(slot, body);

      expect(body).not.toContain('#version');
      expect(body).not.toContain('void main');
      expect(source.match(/void main\(\)/g)).toHaveLength(1);
      expect(source).toContain('fragColor =');
    }
  });

  it('brushes longer in wind than the house mapping', () => {
    const windy: WeatherSnapshot = { ...offlineSnapshot, windSpeedKmh: 42 };

    expect(createScene(windy, 1844, turner).gestures.strokeLength).toBeGreaterThan(
      createScene(windy, 1844).gestures.strokeLength,
    );
  });
});
