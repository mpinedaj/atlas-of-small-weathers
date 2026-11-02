import type { WeatherSnapshot } from '../../core/types';
import bogotaForecast from './bogota-forecast.json';
import { parseForecast } from '../openMeteo';
import { DEFAULT_PLACE } from '../places';

/**
 * The offline painting.
 *
 * Rather than freeze a derived snapshot, we keep a recorded Open-Meteo response
 * and run it through the same parser as live data. If the parser changes, the
 * sample changes with it; the fixture cannot silently drift out of shape.
 */
export const offlineSnapshot: WeatherSnapshot = parseForecast(bogotaForecast, DEFAULT_PLACE);

export const OFFLINE_NOTE = 'Offline sample — a rainy afternoon in Bogotá, recorded for the atlas.';
