import type { Place, PlaceSearchResult, PlaceSource } from '../data';
import { placeLabel, searchPlaces } from '../data';

/**
 * The place search.
 *
 * One field, one list. It behaves like the ARIA combobox pattern rather than a
 * custom widget: the input carries the role, the listbox is a real listbox, the
 * active option is announced with `aria-activedescendant`, and every state
 * (loading, empty, resting) is written in plain language for screen readers.
 *
 * Search is debounced because geocoding is a network call. A new query aborts
 * the previous one, so a fast typist never sees a stale list or an offline
 * painting flash.
 */

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export interface PlaceSearchOptions {
  readonly initialPlace: Place;
  readonly offline?: boolean;
  readonly debounceMs?: number;
  readonly onSelect: (place: Place) => void;
}

export interface PlaceSearch {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  setPlace(place: Place): void;
  setBusy(busy: boolean): void;
  setStatus(message: string): void;
  close(): void;
  focus(): void;
  destroy(): void;
}

function sourceNote(source: PlaceSource): string {
  if (source === 'cache') return 'Remembered from an earlier search.';
  if (source === 'offline') return 'The geocoder is resting; showing the atlas’s own places.';
  return '';
}

export function createPlaceSearch(options: PlaceSearchOptions): PlaceSearch {
  const debounceMs = options.debounceMs ?? SEARCH_DEBOUNCE_MS;

  const wrapper = document.createElement('div');
  wrapper.className = 'atlas__search';
  wrapper.dataset.open = 'false';

  const label = document.createElement('label');
  label.className = 'visually-hidden';
  label.htmlFor = 'atlas-place-search';
  label.textContent = 'Search for a place';

  const input = document.createElement('input');
  input.className = 'atlas__search-input';
  input.id = 'atlas-place-search';
  input.type = 'search';
  input.placeholder = 'Find another sky';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'atlas-place-results');
  input.setAttribute('aria-describedby', 'atlas-place-status');
  input.setAttribute('enterkeyhint', 'go');

  const list = document.createElement('ul');
  list.className = 'atlas__results';
  list.id = 'atlas-place-results';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Places');
  list.hidden = true;

  const status = document.createElement('p');
  status.className = 'atlas__search-status';
  status.id = 'atlas-place-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  wrapper.append(label, input, list, status);

  let current: Place = options.initialPlace;
  let results: readonly Place[] = [];
  let active = -1;
  let timer = 0;
  let controller: AbortController | null = null;
  let destroyed = false;

  input.value = current.name;

  const setExpanded = (expanded: boolean): void => {
    input.setAttribute('aria-expanded', String(expanded));
    list.hidden = !expanded;
    wrapper.dataset.open = String(expanded);
    if (!expanded) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
    }
  };

  const updateActive = (): void => {
    const items = list.querySelectorAll<HTMLElement>('[role="option"]');
    items.forEach((item, index) => {
      const selected = index === active;
      item.setAttribute('aria-selected', String(selected));
      item.dataset.active = String(selected);
    });
    if (active >= 0) {
      const id = `atlas-place-option-${active}`;
      input.setAttribute('aria-activedescendant', id);
      items[active]?.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const close = (restore = true): void => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    controller?.abort();
    controller = null;
    results = [];
    active = -1;
    list.replaceChildren();
    setExpanded(false);
    wrapper.dataset.loading = 'false';
    if (restore) input.value = current.name;
    status.textContent = '';
  };

  const selectPlace = (place: Place, focusInput = false): void => {
    current = place;
    input.value = place.name;
    close();
    if (focusInput) input.focus();
    options.onSelect(place);
  };

  const choose = (index: number): void => {
    const place = results[index];
    if (place) selectPlace(place);
  };

  const render = (result: PlaceSearchResult, query: string): void => {
    results = result.places;
    active = -1;
    list.replaceChildren();

    if (results.length === 0) {
      setExpanded(false);
      status.textContent = `No place called “${query}” yet.`;
      return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach((place, index) => {
      const item = document.createElement('li');
      item.className = 'atlas__result';
      item.id = `atlas-place-option-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.dataset.active = 'false';

      const name = document.createElement('span');
      name.className = 'atlas__result-name';
      name.textContent = place.name;

      const meta = document.createElement('span');
      meta.className = 'atlas__result-meta';
      meta.textContent = placeLabel(place).slice(place.name.length + 1) || ' ';

      item.append(name, meta);
      item.addEventListener('pointerdown', (event) => {
        // Keep focus in the input; selecting an option must not blur first.
        event.preventDefault();
      });
      item.addEventListener('pointermove', () => {
        active = index;
        updateActive();
      });
      item.addEventListener('click', () => choose(index));
      fragment.append(item);
    });

    list.append(fragment);
    setExpanded(true);
    const note = sourceNote(result.source);
    status.textContent = note;
  };

  const run = async (query: string): Promise<void> => {
    if (destroyed) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      close(false);
      status.textContent = trimmed.length === 0 ? '' : 'Type at least two letters.';
      return;
    }

    controller?.abort();
    const request = new AbortController();
    controller = request;
    status.textContent = `Searching for “${trimmed}”…`;
    wrapper.dataset.loading = 'true';

    try {
      const result = await searchPlaces(trimmed, {
        offline: options.offline,
        signal: request.signal,
      });
      if (request.signal.aborted) return;
      render(result, trimmed);
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setExpanded(false);
      status.textContent = 'Search is resting just now. Try again in a moment.';
    } finally {
      if (controller === request) {
        controller = null;
        wrapper.dataset.loading = 'false';
      }
    }
  };

  const schedule = (): void => {
    if (timer) window.clearTimeout(timer);
    const query = input.value;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      close(false);
      status.textContent = query.trim().length === 0 ? '' : 'Type at least two letters.';
      return;
    }
    timer = window.setTimeout(() => {
      timer = 0;
      void run(query);
    }, debounceMs);
  };

  const move = (delta: number): void => {
    if (results.length === 0) return;
    if (active < 0) active = delta > 0 ? 0 : results.length - 1;
    else active = (active + delta + results.length) % results.length;
    updateActive();
  };

  input.addEventListener('focus', () => {
    if (input.value === current.name) input.select();
  });

  input.addEventListener('input', schedule);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden && results.length > 0) setExpanded(true);
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      if (!list.hidden && results.length > 0) {
        event.preventDefault();
        choose(active >= 0 ? active : 0);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!list.hidden) close();
      else {
        input.value = current.name;
        input.blur();
      }
      return;
    }
    if (event.key === 'Tab') close();
  });

  input.addEventListener('blur', () => {
    // A pointerdown on an option prevents blur; a real blur means the visitor
    // moved on, so the field returns to the place that is actually painted.
    window.setTimeout(() => {
      if (document.activeElement !== input) close();
    }, 0);
  });

  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (!wrapper.contains(event.target as Node)) close();
  };

  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const editing =
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable === true;
    if (editing) return;
    event.preventDefault();
    input.focus();
    input.select();
  };

  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown);

  return {
    element: wrapper,
    input,
    setPlace(place: Place): void {
      current = place;
      input.value = place.name;
      close();
    },
    setBusy(busy: boolean): void {
      wrapper.dataset.busy = String(busy);
      input.setAttribute('aria-busy', String(busy));
    },
    setStatus(message: string): void {
      status.textContent = message;
    },
    close(): void {
      close();
    },
    focus(): void {
      input.focus();
      input.select();
    },
    destroy(): void {
      destroyed = true;
      close(false);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    },
  };
}
