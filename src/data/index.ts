/**
 * The weather layer's public surface.
 *
 * The interface should not import Open-Meteo URLs or cache details; it asks for
 * a place, a reading and a set of gestures.
 */
export {
  annualMeanTemperatureC,
  baselineTemperatureC,
  dayOfYear,
  seasonalAmplitudeC,
  warmthAnomaly,
} from './baseline';
export { WeatherCache, CACHE_NAMESPACE, createMemoryStorage, weatherCache } from './cache';
export type { CacheHit, CacheOptions, CacheStorage } from './cache';
export { GEOCODING_TTL_MS, normaliseQuery, offlinePlaces, searchPlaces } from './geocoding';
export type { PlaceSearchResult, PlaceSource, SearchOptions } from './geocoding';
export { defaultMapping, resolveMapping, toGestureState, toPaletteContext } from './gestures';
export { OFFLINE_NOTE, offlineSnapshot } from './fixtures';
export { WeatherError, fetchForecast, fetchPlaces, forecastUrl, geocodingUrl } from './openMeteo';
export type { WeatherErrorCode } from './openMeteo';
export { CURATED_PLACES, DEFAULT_PLACE, placeLabel, samePlace } from './places';
export type { Place } from './places';
export { WEATHER_TTL_MS, loadWeather, weatherCacheKey } from './weather';
export type { LoadWeatherOptions, WeatherResult, WeatherSource } from './weather';
export { describeWeatherCode } from './wmo';
export type { WeatherCodeInfo } from './wmo';
