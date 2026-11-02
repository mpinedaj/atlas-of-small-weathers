/**
 * Places we know without asking the geocoder.
 *
 * They serve three purposes: the default opening, an offline city search, and a
 * stable list of climates for tests and screenshots. Live search results are
 * still preferred whenever the network is available.
 */

export interface Place {
  readonly id?: number;
  readonly name: string;
  readonly country?: string;
  readonly admin1?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone?: string;
  readonly elevation?: number;
}

/** The first sky the atlas paints, and the fallback when nothing else is known. */
export const DEFAULT_PLACE: Place = {
  name: 'Bogotá',
  country: 'Colombia',
  admin1: 'Bogotá D.C.',
  latitude: 4.6097,
  longitude: -74.0817,
  timezone: 'America/Bogota',
  elevation: 2640,
};

/**
 * A deliberately small, geographically spread list. Offline search uses it, and
 * it gives the interface something honest to offer when the geocoder is down.
 */
export const CURATED_PLACES: readonly Place[] = [
  DEFAULT_PLACE,
  {
    name: 'London',
    country: 'United Kingdom',
    admin1: 'England',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    elevation: 11,
  },
  {
    name: 'Kyoto',
    country: 'Japan',
    admin1: 'Kyoto',
    latitude: 35.0116,
    longitude: 135.7681,
    timezone: 'Asia/Tokyo',
    elevation: 55,
  },
  {
    name: 'New York',
    country: 'United States',
    admin1: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    elevation: 10,
  },
  {
    name: 'Lagos',
    country: 'Nigeria',
    admin1: 'Lagos',
    latitude: 6.5244,
    longitude: 3.3792,
    timezone: 'Africa/Lagos',
    elevation: 41,
  },
  {
    name: 'Reykjavík',
    country: 'Iceland',
    admin1: 'Capital Region',
    latitude: 64.1466,
    longitude: -21.9426,
    timezone: 'Atlantic/Reykjavik',
    elevation: 61,
  },
  {
    name: 'Mexico City',
    country: 'Mexico',
    admin1: 'Mexico City',
    latitude: 19.4326,
    longitude: -99.1332,
    timezone: 'America/Mexico_City',
    elevation: 2240,
  },
  {
    name: 'Cape Town',
    country: 'South Africa',
    admin1: 'Western Cape',
    latitude: -33.9249,
    longitude: 18.4241,
    timezone: 'Africa/Johannesburg',
    elevation: 15,
  },
  {
    name: 'Lisbon',
    country: 'Portugal',
    admin1: 'Lisbon',
    latitude: 38.7223,
    longitude: -9.1393,
    timezone: 'Europe/Lisbon',
    elevation: 2,
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: 'Asia/Singapore',
    elevation: 15,
  },
  {
    name: 'Tromsø',
    country: 'Norway',
    admin1: 'Troms',
    latitude: 69.6492,
    longitude: 18.9553,
    timezone: 'Europe/Oslo',
    elevation: 10,
  },
  {
    name: 'Sydney',
    country: 'Australia',
    admin1: 'New South Wales',
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: 'Australia/Sydney',
    elevation: 58,
  },
];

/** A place's name plus its region, for disambiguating search results. */
export function placeLabel(place: Place): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ');
}

/** Whether a place is close enough to another to reuse its weather. */
export function samePlace(a: Place, b: Place): boolean {
  const sameName = a.name.toLowerCase() === b.name.toLowerCase();
  return (
    sameName &&
    Math.abs(a.latitude - b.latitude) < 0.001 &&
    Math.abs(a.longitude - b.longitude) < 0.001
  );
}
