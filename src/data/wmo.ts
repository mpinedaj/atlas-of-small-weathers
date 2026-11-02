import type { Condition } from '../core/types';

export interface WeatherCodeInfo {
  readonly condition: Condition;
  readonly description: string;
}

/**
 * WMO 4677 interpretation codes, as used by Open-Meteo.
 *
 * The wording stays plain and specific: "Light drizzle" is more useful than
 * "Drizzle: light intensity". The painting carries the poetry.
 */
const CODES: Readonly<Record<number, WeatherCodeInfo>> = {
  0: { condition: 'clear', description: 'Clear sky' },
  1: { condition: 'clear', description: 'Mainly clear' },
  2: { condition: 'cloudy', description: 'Partly cloudy' },
  3: { condition: 'cloudy', description: 'Overcast' },
  45: { condition: 'fog', description: 'Fog' },
  48: { condition: 'fog', description: 'Rime fog' },
  51: { condition: 'rain', description: 'Light drizzle' },
  53: { condition: 'rain', description: 'Drizzle' },
  55: { condition: 'rain', description: 'Dense drizzle' },
  56: { condition: 'rain', description: 'Freezing drizzle' },
  57: { condition: 'rain', description: 'Dense freezing drizzle' },
  61: { condition: 'rain', description: 'Light rain' },
  63: { condition: 'rain', description: 'Rain' },
  65: { condition: 'rain', description: 'Heavy rain' },
  66: { condition: 'rain', description: 'Freezing rain' },
  67: { condition: 'rain', description: 'Heavy freezing rain' },
  71: { condition: 'snow', description: 'Light snow' },
  73: { condition: 'snow', description: 'Snow' },
  75: { condition: 'snow', description: 'Heavy snow' },
  77: { condition: 'snow', description: 'Snow grains' },
  80: { condition: 'rain', description: 'Light rain showers' },
  81: { condition: 'rain', description: 'Rain showers' },
  82: { condition: 'rain', description: 'Violent rain showers' },
  85: { condition: 'snow', description: 'Light snow showers' },
  86: { condition: 'snow', description: 'Heavy snow showers' },
  95: { condition: 'storm', description: 'Thunderstorm' },
  96: { condition: 'storm', description: 'Thunderstorm with hail' },
  99: { condition: 'storm', description: 'Severe thunderstorm with hail' },
};

const UNKNOWN: WeatherCodeInfo = {
  condition: 'cloudy',
  description: 'Unsettled sky',
};

/** Translate a WMO code into a painting family and a human sentence. */
export function describeWeatherCode(code: number): WeatherCodeInfo {
  return CODES[code] ?? UNKNOWN;
}
