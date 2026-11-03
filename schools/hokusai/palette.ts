import type { Condition, Palette, PaletteContext, WeatherSnapshot } from '../../src/core/types';

/**
 * Hokusai's weather.
 *
 * A print, not a scene: a handful of pigments, flat areas, one red note. The
 * condition chooses the block of colour; warmth moves the Prussian blue toward
 * green or violet. The palette stays deliberately narrow, because the linework
 * has to carry the weather.
 */

const INK = '#162026';

const WARM_SHIFT = ['#f0e2c3', '#d8c99f', '#bfae83', '#9d916b', '#7c7b5f', '#5c6556'] as const;
const COOL_SHIFT = ['#dde4dc', '#b8c9c8', '#8ea8ad', '#628694', '#3f687b', '#274b62'] as const;

type Mood = Omit<Palette, 'ink'>;

const CONDITIONS: Record<Condition, Mood> = {
  clear: {
    ground: '#efe3c8',
    washes: ['#e9dfc7', '#c3d0cd', '#8fabb1', '#557f95', '#2c5c77', '#173a54'],
    accent: '#b13a28',
    highlight: '#fbf3dd',
    shadow: '#1b2a31',
  },
  cloudy: {
    ground: '#e5dfca',
    washes: ['#e0dcc9', '#c2c4b8', '#9ca7a2', '#72888a', '#4c6972', '#2d4b58'],
    accent: '#a64832',
    highlight: '#f5f0dc',
    shadow: '#1c2c33',
  },
  rain: {
    ground: '#dfdcc8',
    washes: ['#dcddca', '#bcc7c0', '#94a9a5', '#6c898d', '#466a76', '#284c5d'],
    accent: '#a33f2c',
    highlight: '#f4efdb',
    shadow: '#192b34',
  },
  storm: {
    ground: '#d4d2c2',
    washes: ['#d2d2c4', '#adb4af', '#849496', '#5c737b', '#3a555f', '#203946'],
    accent: '#9b3a2b',
    highlight: '#eee9d6',
    shadow: '#14242c',
  },
  snow: {
    ground: '#f3ebda',
    washes: ['#f2ebdb', '#deddd0', '#bcc6c4', '#96a8a9', '#6f888e', '#4b6570'],
    accent: '#a34b36',
    highlight: '#fff9e8',
    shadow: '#2c414b',
  },
  fog: {
    ground: '#ece5d2',
    washes: ['#eae3d1', '#d3cebc', '#b2b3a6', '#8d9893', '#687a79', '#465a5c'],
    accent: '#9c4c37',
    highlight: '#f9f2df',
    shadow: '#2b3b3d',
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
  const amount = Math.abs(warmth) * (warmth >= 0 ? 0.18 : 0.16);

  // Night keeps the print legible but exchanges paper for a deeper block.
  const night = weather.isDay ? 0 : 0.28;

  return {
    ground: mix(mood.ground, '#b9b6a6', night * 0.6),
    ink: INK,
    accent: mix(mood.accent, warmth >= 0 ? '#c04a2c' : '#8d3c44', amount * 0.7),
    highlight: mix(mood.highlight, '#e7e2d1', night),
    shadow: mix(mood.shadow, '#101a20', night * 0.8),
    washes: mood.washes.map((colour, index) =>
      mix(
        mix(colour, '#b4b2a4', night * 0.45),
        target[Math.min(index, target.length - 1)] ?? colour,
        amount,
      ),
    ),
  };
}

export default palette;
