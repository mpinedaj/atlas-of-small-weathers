/**
 * Public vocabulary of the atlas.
 *
 * These types are the contract between the weather layer, the painting engine
 * and the school plugins. Nothing here imports a concrete school, a renderer or
 * the DOM: schools can be written and tested against this file alone.
 */

/** Six weather families, broad enough to paint, narrow enough to feel true. */
export type Condition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

/** A single, fully derived weather reading for one place and moment. */
export interface WeatherSnapshot {
  /** Human readable place name, e.g. "Bogotá". */
  readonly city: string;
  /** Country name, when the geocoder provides it. */
  readonly country?: string;
  /** First administrative division, when available. */
  readonly admin1?: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Elevation in metres, when the provider reports it. Used for the baseline. */
  readonly elevationM?: number;
  /** IANA timezone from Open-Meteo, e.g. "America/Bogota". */
  readonly timezone: string;
  /** ISO timestamp of the observation, in the place's own timezone. */
  readonly observedAt: string;
  readonly temperatureC: number;
  readonly apparentTemperatureC: number;
  /** Relative humidity, 0–100. */
  readonly humidity: number;
  /** Cloud cover, 0–100. */
  readonly cloudCover: number;
  /** Mean sea-level pressure in hPa. */
  readonly pressureHpa: number;
  /** Precipitation in the last hour, millimetres. */
  readonly precipitationMm: number;
  readonly windSpeedKmh: number;
  /** Meteorological direction: the direction the wind comes *from*, degrees. */
  readonly windDirectionDeg: number;
  readonly isDay: boolean;
  /** Raw WMO weather interpretation code. */
  readonly weatherCode: number;
  readonly condition: Condition;
  /** Short, human description, e.g. "Light drizzle". */
  readonly description: string;
  /**
   * Seasonal temperature expectation for this latitude and day of year.
   * Warmth is always relative to this, never to an absolute scale.
   */
  readonly baselineTemperatureC: number;
  /** Temperature anomaly, clamped to -1…1. Negative is colder than usual. */
  readonly warmth: number;
}

/** A pigment set. Colours are CSS hex strings so schools stay renderer-agnostic. */
export interface Palette {
  /** The paper the painting sits on. */
  readonly ground: string;
  /** Darkest mark: ink, graphite, sumi. */
  readonly ink: string;
  /** A single accent used sparingly by the school. */
  readonly accent: string;
  /** Three to six wash colours, ordered from light to dense. */
  readonly washes: readonly string[];
  /** Lightest passage: sky, foam, bloom. */
  readonly highlight: string;
  /** Deepest passage: mass, storm, undertow. */
  readonly shadow: string;
}

/** Everything a palette function may look at beyond the weather itself. */
export interface PaletteContext {
  readonly condition: Condition;
  readonly isDay: boolean;
  /** -1…1, relative to the seasonal baseline. */
  readonly warmth: number;
  /** 0…1. */
  readonly humidity: number;
  /** 0…1. */
  readonly cloud: number;
  /** 0…1, where 1 is heavy. */
  readonly pressure: number;
  /** 0…1. */
  readonly rain: number;
  readonly seed: number;
}

/**
 * The complete set of gestures a painting needs. Every value is normalised so
 * shaders can consume it without knowing the weather API.
 */
export interface GestureState {
  /** -1…1 relative warmth. */
  readonly warmth: number;
  /** 0…1, Beaufort-like wind force. */
  readonly windSpeed: number;
  /** Radians, the direction the wind travels *towards*. */
  readonly windDirection: number;
  /** Unit vector of the wind, in screen space (x right, y down). */
  readonly windVector: readonly [number, number];
  /** 0…1, how long and taut the strokes become. */
  readonly tension: number;
  /** 0…1, the veil of moisture in the air. */
  readonly humidityVeil: number;
  /** 0…1, the mass of cloud in the upper field. */
  readonly cloudMass: number;
  /** 0…1, where 1 is heavy and low. */
  readonly pressureWeight: number;
  /** 0…1, pigment that runs and granulates. */
  readonly rainGrain: number;
  /** 0…1 daylight, 0 at night. */
  readonly light: number;
  /** 0…1, the visual length of a brush mark. */
  readonly strokeLength: number;
}

/** The keys a school is allowed to remap. */
export type GestureKey = keyof GestureState;

/** One pure function per gesture, so a school can override just one. */
export type DataToGesture = {
  readonly [K in GestureKey]: (weather: WeatherSnapshot) => GestureState[K];
};

/** Shader sources, injected into the core pipeline. */
export interface ShaderSet {
  /** Background atmosphere. Draws paper, washes, dye and light. */
  readonly field: string;
  /** Vector field that advects brushes. Outputs vec2 in RG. */
  readonly flow: string;
  /** One brush mark, drawn as an instanced quad. */
  readonly brush: string;
  /** Final paper, grain, bloom and vignette. */
  readonly post: string;
}

export type ShaderSlot = keyof ShaderSet;

/** Metadata every school folder declares in `school.json`. */
export interface SchoolMeta {
  /** URL-safe id, matching the folder name. */
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly license: string;
  /** One or two sentences, shown in the interface and the gallery. */
  readonly description: string;
  /** Artistic references. Inspiration, never reproduction. */
  readonly references: readonly string[];
  readonly version: string;
}

/**
 * A painterly school. This is the whole plugin surface.
 *
 * The core discovers schools from `/schools/*`, validates their metadata and
 * merges their optional overrides over the default mapping and shaders. A school
 * never imports core code and never needs the core to be edited.
 */
export interface School {
  readonly meta: SchoolMeta;
  palette(weather: WeatherSnapshot, context: PaletteContext): Palette;
  /** Override any subset of the default data-to-gesture mapping. */
  readonly mapping?: Partial<DataToGesture>;
  /** Override any subset of the default GLSL passes. */
  readonly shaders?: Partial<ShaderSet>;
}
