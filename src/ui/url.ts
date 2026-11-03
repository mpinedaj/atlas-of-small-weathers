/**
 * URL state, written without navigation.
 *
 * The address bar is the only save file: a painting is reproducible from its
 * city, school, seed and mode. Controls therefore update the current history
 * entry instead of pushing new ones, so Back still leaves the atlas rather than
 * stepping through every school the visitor tried.
 */

/**
 * Return `href` with one search parameter set, replaced or removed. Pure, so it
 * can be tested without a DOM and reused for the share action later.
 */
export function urlWithParam(href: string, name: string, value: string | null): string {
  const url = new URL(href);
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') url.searchParams.delete(name);
  else url.searchParams.set(name, trimmed);
  return url.href;
}

/** Update the current history entry. Keeps every other parameter intact. */
export function replaceSearchParam(name: string, value: string | null): void {
  window.history.replaceState(
    window.history.state,
    '',
    urlWithParam(window.location.href, name, value),
  );
}
