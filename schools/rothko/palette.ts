import type { Condition, Palette, PaletteContext, WeatherSnapshot } from '../../src/core/types';

/**
 * Rothko's weather.
 *
 * The palette is not a landscape set. It is a set of neighbouring colour fields
 * that have to sit beside each other without settling: warm earth against a
 * bruised plum, a grey that still remembers blue. Weather chooses the family;
 * relative warmth moves the whole family a little, never enough to explain it.
 */

const INK = '#241719';

const WARM_SHIFT = ['#f0c98f', '#dca36d', '#c47a4f', '#9d523e', '#753a34', '#4a2427'] as const;
const COOL_SHIFT = ['#c8ccd0', '#a8b0b7', '#858f9a', '#626e7b', '#46525f', '#2c3641'] as const;

type Mood = Omit<Palette, 'ink'>;

const CONDITIONS: Record<Condition, Mood> = {
  clear: {
    ground: '#5c332b',
    washes: ['#f2d5a1', '#e3b171', '#d18a4d', '#ad603d', '#813f35', '#55272b'],
    accent: '#c25432',
    highlight: '#ffe8bd',
    shadow: '#2d191b',
  },
  cloudy: {
    ground: '#443a3b',
    washes: ['#d8cbc5', '#beaaa7', '#9d878b', '#7b626c', '#594854', '#392f39'],
    accent: '#a45a45',
    highlight: '#f2e4d4',
    shadow: '#241e26',
  },
  rain: {
    ground: '#29383b',
    washes: ['#b1bab2', '#8b9f9b', '#688582', '#4c6a6b', '#344d53', '#21323a'],
    accent: '#a35d48',
    highlight: '#dce2d3',
    shadow: '#162329',
  },
  storm: {
    ground: '#251b1e',
    washes: ['#bda79c', '#9b7e77', '#785d59', '#583f41', '#3a282d', '#23171c'],
    accent: '#b04b32',
    highlight: '#e4d2c1',
    shadow: '#150e12',
  },
  snow: {
    ground: '#4d5458',
    washes: ['#eee8de', '#d5d2ca', '#b2b6b7', '#8c959b', '#69747d', '#49535e'],
    accent: '#9e5f4c',
    highlight: '#fbf7ed',
    shadow: '#2d343c',
  },
  fog: {
    ground: '#514a43',
    washes: ['#e3d9c9', '#cabbab', '#ae9f8e', '#8e8073', '#6d6158', '#4d443e'],
    accent: '#a5644a',
    highlight: '#f7eee0',
    shadow: '#302925',
  },
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function channel(value: number): string {
  return Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, '0');
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function mix(a: string, b: string, amount: number): string {
  const left = toRgb(a);
  const right = toRgb(b);
  const t = clamp01(amount);
  return `#${channel(left[0] + (right[0] - left[0]) * t)}${channel(
    left[1] + (right[1] - left[1]) * t,
  )}${channel(left[2] + (right[2] - left[2]) * t)}`;
}

export function palette(weather: WeatherSnapshot, context: PaletteContext): Palette {
  const mood = CONDITIONS[weather.condition];
  const warmth = Math.max(-1, Math.min(1, context.warmth));
  const target = warmth >= 0 ? WARM_SHIFT : COOL_SHIFT;
  const amount = Math.abs(warmth) * (warmth >= 0 ? 0.3 : 0.24);

  const ground = weather.isDay ? mood.ground : mix(mood.ground, '#1b1417', 0.22);

  return {
    ground,
    ink: INK,
    accent: mix(mood.accent, warmth >= 0 ? '#cf5a32' : '#7d4657', amount * 0.7),
    highlight: mix(mood.highlight, warmth >= 0 ? '#ffecc6' : '#dbe3e4', amount * 0.5),
    shadow: mix(mood.shadow, warmth >= 0 ? '#281417' : '#141c25', amount * 0.4),
    washes: mood.washes.map((colour, index) =>
      mix(colour, target[Math.min(index, target.length - 1)] ?? colour, amount),
    ),
  };
}

export default palette;
