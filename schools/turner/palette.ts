import type { Condition, Palette, PaletteContext, WeatherSnapshot } from '../../src/core/types';

/**
 * Turner's weather palette.
 *
 * Each condition gets its own ground and washes: a rain sky is not a clear sky
 * desaturated, it is a different mixture. Warmth then pulls the whole set
 * toward ochre or slate, and night washes the colour out without turning it
 * black. The accent is the one warm note Turner rarely leaves out — a sail, a
 * funnel, a spark of vermilion in the murk.
 */

type Mood = Omit<Palette, 'ink'>;

const INK = '#17140f';

const WARM_SHIFT = ['#f4e2bd', '#e5c491', '#d3a266', '#b97b54', '#905b47', '#65443c'] as const;
const COOL_SHIFT = ['#d9e0dd', '#b9c9c6', '#94aaa8', '#728e91', '#536d75', '#384d58'] as const;

const CLEAR: Mood = {
  ground: '#f0e7d4',
  washes: ['#f8eccd', '#efd8a8', '#dfba79', '#c88e5d', '#9e654a', '#6c4a3e'],
  accent: '#a9472b',
  highlight: '#fff7e0',
  shadow: '#332a23',
};

const NIGHT: Mood = {
  ground: '#d7d1c2',
  washes: ['#c8cbc4', '#9fa9ac', '#74808d', '#525e6d', '#36414f', '#202a36'],
  accent: '#9c573d',
  highlight: '#f4ead2',
  shadow: '#151b23',
};

const CONDITIONS: Record<Condition, Mood> = {
  clear: CLEAR,
  cloudy: {
    ground: '#ece5d4',
    washes: ['#ece5d3', '#d8d1bf', '#b9b7aa', '#999c94', '#747b73', '#4f5851'],
    accent: '#9b5b3c',
    highlight: '#fff8e6',
    shadow: '#2e332e',
  },
  rain: {
    ground: '#e8e0ce',
    washes: ['#e9e1cf', '#cec8b5', '#aaa9a0', '#858c87', '#616c68', '#404b49'],
    accent: '#b25536',
    highlight: '#fff7df',
    shadow: '#293331',
  },
  storm: {
    ground: '#ddd5c1',
    washes: ['#ded6c2', '#bab4a3', '#918f83', '#6b6e67', '#4a5150', '#2d3436'],
    accent: '#a3482f',
    highlight: '#f6efda',
    shadow: '#1f2628',
  },
  snow: {
    ground: '#f1eade',
    washes: ['#f6efe1', '#e6dfd1', '#cdcdc5', '#afb5b2', '#8a9393', '#626d6e'],
    accent: '#9c5d49',
    highlight: '#fffaf0',
    shadow: '#394547',
  },
  fog: {
    ground: '#eee8da',
    washes: ['#f0e9db', '#e0dacb', '#c8c5b9', '#acaca3', '#8d908b', '#6b706d'],
    accent: '#9f6147',
    highlight: '#fff9e9',
    shadow: '#3d4342',
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

function conditionMood(weather: WeatherSnapshot): Mood {
  const mood = CONDITIONS[weather.condition];
  if (weather.isDay || weather.condition === 'storm') return mood;
  return {
    ...mood,
    washes: mood.washes.map((colour) => mix(colour, NIGHT.washes[0] ?? colour, 0.42)),
    accent: mix(mood.accent, NIGHT.accent, 0.35),
    highlight: mix(mood.highlight, NIGHT.highlight, 0.4),
    shadow: mix(mood.shadow, NIGHT.shadow, 0.5),
  };
}

export function palette(weather: WeatherSnapshot, context: PaletteContext): Palette {
  const mood = conditionMood(weather);
  const warmth = Math.max(-1, Math.min(1, context.warmth));
  const target = warmth >= 0 ? WARM_SHIFT : COOL_SHIFT;
  const amount = Math.abs(warmth) * (warmth >= 0 ? 0.28 : 0.2);

  return {
    ground: mood.ground,
    ink: INK,
    accent: mix(mood.accent, warmth >= 0 ? '#b44a26' : '#7b4b58', amount * 0.8),
    highlight: mood.highlight,
    shadow: mix(mood.shadow, warmth >= 0 ? '#2a1d17' : '#151e28', amount * 0.5),
    washes: mood.washes.map((colour, index) =>
      mix(colour, target[Math.min(index, target.length - 1)] ?? colour, amount),
    ),
  };
}

export default palette;
