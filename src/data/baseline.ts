/**
 * Seasonal expectation for a place and day.
 *
 * The painting should know that 18 °C is a warm winter in Bogotá and a cold
 * summer in Oslo. Rather than fetch a climatology, we estimate the annual mean
 * from latitude and elevation, add a seasonal swing that grows with latitude,
 * and let the anomaly do the talking.
 *
 * This is a sketch, not a climate model. Its limits are documented on purpose.
 */

const TROPICAL_MEAN_C = 26.5;
const TROPICAL_COOLING_PER_DEGREE = 0.18;
const SUBTROPICAL_COOLING_PER_DEGREE = 0.45;
const SUBPOLAR_COOLING_PER_DEGREE = 0.6;
const POLAR_COOLING_PER_DEGREE = 0.8;

/** Free-air lapse rate is 6.5 °C/km; cities sit in warmer boundary layers. */
const ELEVATION_COOLING_PER_METRE = 0.0045;

const MIN_AMPLITUDE_C = 1.2;
const MAX_AMPLITUDE_C = 13;

/** Approximate zonal annual mean temperature, before elevation. */
export function annualMeanTemperatureC(latitude: number): number {
  const abs = Math.min(90, Math.abs(latitude));
  if (abs <= 25) return TROPICAL_MEAN_C - TROPICAL_COOLING_PER_DEGREE * abs;
  if (abs <= 45) {
    return (
      TROPICAL_MEAN_C -
      TROPICAL_COOLING_PER_DEGREE * 25 -
      SUBTROPICAL_COOLING_PER_DEGREE * (abs - 25)
    );
  }
  if (abs <= 65) {
    const at45 =
      TROPICAL_MEAN_C - TROPICAL_COOLING_PER_DEGREE * 25 - SUBTROPICAL_COOLING_PER_DEGREE * 20;
    return at45 - SUBPOLAR_COOLING_PER_DEGREE * (abs - 45);
  }
  const at65 =
    TROPICAL_MEAN_C -
    TROPICAL_COOLING_PER_DEGREE * 25 -
    SUBTROPICAL_COOLING_PER_DEGREE * 20 -
    SUBPOLAR_COOLING_PER_DEGREE * 20;
  return at65 - POLAR_COOLING_PER_DEGREE * (abs - 65);
}

/** Day length of the seasonal cycle at this latitude, in °C. */
export function seasonalAmplitudeC(latitude: number): number {
  const abs = Math.abs(latitude);
  const amplitude = (abs - 10) * 0.22;
  return Math.max(MIN_AMPLITUDE_C, Math.min(MAX_AMPLITUDE_C, amplitude));
}

/** Day of year, 1–366, from an ISO date or local ISO datetime. */
export function dayOfYear(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) : now.getUTCMonth() + 1;
  const day = match ? Number(match[3]) : now.getUTCDate();
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(current) || current < start) return 1;
  return Math.floor((current - start) / 86_400_000) + 1;
}

/**
 * Expected temperature for a latitude, day and elevation.
 *
 * The northern hemisphere peaks near 25 July; the southern hemisphere peaks
 * half a year later. The tropics keep a small swing all year.
 */
export function baselineTemperatureC(
  latitude: number,
  elevationM: number | undefined,
  isoDate: string,
): number {
  const mean = annualMeanTemperatureC(latitude);
  const elevation = Math.max(0, elevationM ?? 0);
  const atSeaLevel = mean - elevation * ELEVATION_COOLING_PER_METRE;

  const doy = dayOfYear(isoDate);
  const peakDay = latitude >= 0 ? 206 : 25;
  const phase = (2 * Math.PI * (doy - peakDay)) / 365.25;

  return atSeaLevel + seasonalAmplitudeC(latitude) * Math.cos(phase);
}

/**
 * How unusual the temperature is, clamped to -1…1.
 *
 * Eight degrees from the seasonal norm is treated as the edge of the scale: a
 * heatwave or a cold snap of that size already changes what the sky means.
 */
export function warmthAnomaly(temperatureC: number, baselineC: number): number {
  return Math.max(-1, Math.min(1, (temperatureC - baselineC) / 8));
}
