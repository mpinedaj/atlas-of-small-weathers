/**
 * URL state, written without navigation.
 *
 * The address bar is the only save file: a painting is reproducible from its
 * place, school, seed and mode. Controls therefore update the current history
 * entry instead of pushing new ones, so Back still leaves the atlas rather than
 * stepping through every school or seed the visitor tried.
 */

export type AtlasMode = 'live' | 'still';

export interface PlaceState {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface UrlState {
  readonly city: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly school: string | null;
  readonly seed: number | null;
  readonly mode: AtlasMode;
  readonly offline: boolean;
  readonly warmupFrames: number | null;
}

export interface ShareState {
  readonly place: PlaceState;
  readonly school: string | null;
  readonly seed: number;
  readonly mode: AtlasMode;
}

function coordinate(value: string | null, limit: number): number | null {
  if (value === null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function positiveInteger(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Read the address bar.
 *
 * `still=1` predates the public `mode` parameter and remains an alias, so old
 * screenshots and links keep working. Absent mode means live.
 */
export function readUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const city = params.get('city')?.trim() ?? '';
  const seedRaw = params.get('seed')?.trim() ?? '';
  const seed = seedRaw === '' ? null : Number(seedRaw);
  const mode: AtlasMode = params.get('mode') === 'still' || params.has('still') ? 'still' : 'live';

  return {
    city: city === '' ? null : city,
    latitude: coordinate(params.get('lat'), 90),
    longitude: coordinate(params.get('lon'), 180),
    school: params.get('school')?.trim() || null,
    seed: seed !== null && Number.isFinite(seed) ? seed : null,
    mode,
    offline: params.has('offline'),
    warmupFrames: positiveInteger(params.get('warmup')),
  };
}

/**
 * Return `href` with one search parameter set, replaced or removed. Pure, so it
 * can be tested without a DOM and reused by the share action.
 */
export function urlWithParam(href: string, name: string, value: string | null): string {
  const url = new URL(href);
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') url.searchParams.delete(name);
  else url.searchParams.set(name, trimmed);
  return url.href;
}

/**
 * The state an atlas URL must carry. Only the values that actually define the
 * painting are written; test switches such as `offline` and `warmup` stay where
 * they are when the current address bar is updated.
 */
export function urlWithState(href: string, state: ShareState): string {
  const url = new URL(href);
  url.searchParams.set('city', state.place.name);
  url.searchParams.set('lat', state.place.latitude.toFixed(4));
  url.searchParams.set('lon', state.place.longitude.toFixed(4));
  url.searchParams.set('seed', String(state.seed));
  url.searchParams.set('mode', state.mode);
  if (state.school) url.searchParams.set('school', state.school);
  else url.searchParams.delete('school');
  url.searchParams.delete('still');
  return url.href;
}

/** Update the current history entry. Keeps every other parameter intact. */
export function replaceUrlState(state: ShareState): void {
  window.history.replaceState(window.history.state, '', urlWithState(window.location.href, state));
}

/** Update a single parameter on the current history entry. */
export function replaceSearchParam(name: string, value: string | null): void {
  window.history.replaceState(
    window.history.state,
    '',
    urlWithParam(window.location.href, name, value),
  );
}

/**
 * The URL copied by the share action. Unlike the live address bar it is clean:
 * no offline sample, screenshot warm-up or debug switches. The recipient gets
 * the same place, school, seed and mode, live.
 */
export function canonicalShareUrl(href: string, state: ShareState): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('city', state.place.name);
  url.searchParams.set('lat', state.place.latitude.toFixed(4));
  url.searchParams.set('lon', state.place.longitude.toFixed(4));
  url.searchParams.set('seed', String(state.seed));
  url.searchParams.set('mode', state.mode);
  if (state.school) url.searchParams.set('school', state.school);
  return url.href;
}
