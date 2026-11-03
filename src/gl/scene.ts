import type {
  Condition,
  GestureState,
  Palette,
  PaletteContext,
  School,
  ShaderSet,
  WeatherSnapshot,
} from '../core/types';
import { resolveMapping, toGestureState, toPaletteContext } from '../data';
import { hexToRgb, mixRgb } from './color';
import { DEFAULT_SHADERS } from './shaders/defaults';

/**
 * Everything the renderer needs to paint one moment, fully resolved.
 *
 * A scene is data, not behaviour: the weather layer has already become gestures,
 * a school has already chosen pigment and shaders, and the URL has already
 * chosen a seed. Keeping this boundary data-only is what lets schools be
 * plugins and screenshots be deterministic.
 */
export interface PaintingScene {
  readonly schoolId: string;
  readonly schoolName: string;
  readonly seed: number;
  readonly condition: Condition;
  readonly palette: Palette;
  readonly gestures: GestureState;
  readonly shaders: ShaderSet;
}

const PAPER = '#efe7d9';
const INK = '#1b1813';
const ACCENT = '#a9472b';
const HIGHLIGHT = '#f8f2e6';
const SHADOW = '#2b2721';

interface WashMood {
  readonly washes: readonly string[];
  readonly accent: string;
  readonly shadow: string;
}

/** Warm pigments: ochre, rose earth, burnt sienna. */
const WARM: WashMood = {
  washes: ['#f4e3c6', '#e9c9a2', '#d6a475', '#b97c5c', '#8e5c4c', '#61453c'],
  accent: '#a9472b',
  shadow: '#3a2c26',
};

/** Cool pigments: slate, sea green, wet stone. */
const COOL: WashMood = {
  washes: ['#e2e5dd', '#c3cec5', '#9ab0aa', '#769090', '#566f74', '#3b4d55'],
  accent: '#6f4f57',
  shadow: '#26343a',
};

/** The grey a storm leaves behind: less colour, more weight. */
const STORM: WashMood = {
  washes: ['#ddd8c9', '#bdbbb0', '#969b99', '#747c7c', '#525c5c', '#333b3d'],
  accent: '#7d4a3a',
  shadow: '#20272a',
};

/** Night is not black; it is a deeply desaturated blue-brown. */
const NIGHT: WashMood = {
  washes: ['#cfc9bc', '#a8a8a2', '#7f8587', '#616a70', '#464f58', '#2b3037'],
  accent: '#8f5a44',
  shadow: '#1d2228',
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function toHex(rgb: readonly [number, number, number]): string {
  const channel = (value: number): string =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

function mixHex(a: string, b: string, amount: number): string {
  return toHex(mixRgb(hexToRgb(a), hexToRgb(b), amount));
}

/**
 * The house palette, used before a school is chosen and whenever one fails.
 *
 * Warmth decides whether the paper leans ochre or slate; weather decides how
 * much grey enters the washes. It is intentionally quieter and more legible
 * than the three named schools — a ground for them, not a rival.
 */
export function housePalette(weather: WeatherSnapshot, context: PaletteContext): Palette {
  const warmth = clamp01((context.warmth + 1) / 2);
  const grey = clamp01(
    Math.max(context.cloud * 0.55, context.rain * 0.7) + (weather.condition === 'storm' ? 0.18 : 0),
  );

  const from = weather.isDay ? COOL : NIGHT;
  const to = weather.isDay ? WARM : NIGHT;
  const base: WashMood = {
    washes: from.washes.map((colour, index) => mixHex(colour, to.washes[index] ?? colour, warmth)),
    accent: mixHex(from.accent, to.accent, warmth),
    shadow: mixHex(from.shadow, to.shadow, warmth),
  };

  const washes = base.washes.map((colour, index) =>
    mixHex(colour, STORM.washes[index] ?? colour, grey * 0.5),
  );

  return {
    ground: PAPER,
    ink: INK,
    accent: mixHex(base.accent, ACCENT, 0.35),
    washes,
    highlight: HIGHLIGHT,
    shadow: mixHex(base.shadow, SHADOW, 0.3),
  };
}

/**
 * Resolve a school into the data-only scene the renderer paints. Without a
 * school this returns the house scene, which is also the graceful fallback.
 */
export function createScene(
  weather: WeatherSnapshot,
  seed: number,
  school?: School,
): PaintingScene {
  if (!school) return createHouseScene(weather, seed);

  return {
    schoolId: school.meta.id,
    schoolName: school.meta.name,
    seed,
    condition: weather.condition,
    palette: school.palette(weather, toPaletteContext(weather, seed)),
    gestures: toGestureState(weather, resolveMapping(school.mapping)),
    shaders: { ...DEFAULT_SHADERS, ...school.shaders },
  };
}

/**
 * The opening scene. Named schools replace the palette and shaders; the
 * renderer only ever sees a `PaintingScene`.
 */
export function createHouseScene(weather: WeatherSnapshot, seed: number): PaintingScene {
  return {
    schoolId: 'house',
    schoolName: 'House paper',
    seed,
    condition: weather.condition,
    palette: housePalette(weather, toPaletteContext(weather, seed)),
    gestures: toGestureState(weather),
    shaders: DEFAULT_SHADERS,
  };
}
