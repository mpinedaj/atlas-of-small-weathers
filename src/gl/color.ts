/** Colour helpers for the GL boundary. CSS hex in, normalised RGB out. */

export type Rgb = readonly [number, number, number];

const FALLBACK: Rgb = [0, 0, 0];

/** Parse `#rgb` or `#rrggbb` into three sRGB components in 0…1. */
export function hexToRgb(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    return [
      parseInt(value[0]! + value[0]!, 16) / 255,
      parseInt(value[1]! + value[1]!, 16) / 255,
      parseInt(value[2]! + value[2]!, 16) / 255,
    ];
  }
  if (value.length === 6 && /^[0-9a-f]{6}$/i.test(value)) {
    return [
      parseInt(value.slice(0, 2), 16) / 255,
      parseInt(value.slice(2, 4), 16) / 255,
      parseInt(value.slice(4, 6), 16) / 255,
    ];
  }
  return FALLBACK;
}

/** Linear interpolation in sRGB space. Good enough for pigment. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const amount = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

/** Relative luminance, 0 for black and 1 for white. */
export function luminance(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** Format for CSS, e.g. `rgb(239 231 217)`. */
export function toCss(rgb: Rgb): string {
  return `rgb(${Math.round(rgb[0] * 255)} ${Math.round(rgb[1] * 255)} ${Math.round(rgb[2] * 255)})`;
}
