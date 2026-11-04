import './styles/index.css';

import type { WeatherSnapshot } from './core/types';
import { DEFAULT_SEED, normaliseSeed } from './core/seed';
import type { Place, WeatherResult } from './data';
import { CURATED_PLACES, DEFAULT_PLACE, loadWeather, normaliseQuery, samePlace } from './data';
import { CanvasPainter } from './gl/fallback';
import { AtlasRenderer } from './gl/renderer';
import { createHouseScene, createScene } from './gl/scene';
import type { PaintingScene } from './gl/scene';
import { defaultSchool, findSchool, getSchools } from './schools/registry';
import type { SchoolPlugin } from './schools/registry';
import { createIdle } from './ui/idle';
import { crossfadeThroughPaper } from './ui/paper';
import { createPlaceSearch } from './ui/search';
import type { PlaceSearch } from './ui/search';
import { createSeedStepper } from './ui/seed';
import type { SeedStepper } from './ui/seed';
import { createShareButton } from './ui/share';
import { createSchoolSelector } from './ui/schools';
import type { SchoolSelector } from './ui/schools';
import type { AtlasMode, ShareState, UrlState } from './ui/url';
import { readUrlState, replaceUrlState } from './ui/url';

/**
 * The opening screen, and the hand-off between weather and painting.
 *
 * Everything visible here is one of two states: paper while the weather loads,
 * or the painting once it has arrived. The painting is the page; the interface
 * sits on its edges. A textual description carries the same information for
 * screen readers and for anyone who cannot see the canvas.
 *
 * The address bar is the only save file. A city, school or seed change updates
 * the current history entry instead of pushing a new one, so exploring never
 * traps the back button.
 */

const mark = `
  <svg class="boot__mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <path fill="currentColor" opacity=".94"
      d="M74.4 27.9c7 8.1 8.3 20.8 1.7 30.1-6.6 9.4-19.8 12.4-31.7 13.3-11.9.9-24.1-1.9-29.7-9.6-5.6-7.7-3.7-19.8 3.3-29.4C24.9 22.7 36.4 16.8 47.5 18c11.1 1.2 19.9 1.8 26.9 9.9Z"/>
    <path fill="var(--ink)" opacity=".16"
      d="M30.4 61.6c9.2-11.4 23.4-18.6 39.5-18.3-9.3 15.4-23.7 24.5-39.5 24.3Z"/>
  </svg>
`;

interface View {
  readonly place: Place;
  readonly result: WeatherResult;
  readonly seed: number;
  readonly school: SchoolPlugin | null;
  readonly scene: PaintingScene;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

function statusLine(result: WeatherResult, seed: number): string {
  if (result.source === 'offline' && result.note) return result.note;

  const temperature = Math.round(result.snapshot.temperatureC);
  const observed = result.source === 'stale' ? ' · earlier reading' : '';
  return `${result.snapshot.description}, ${temperature}° in ${result.snapshot.city}${observed} · seed ${seed}`;
}

function observedTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match?.[1] ?? '';
}

function cityLabel(snapshot: WeatherSnapshot): string {
  return snapshot.country ? `${snapshot.city}, ${snapshot.country}` : snapshot.city;
}

/** The same painting, told in words. */
function describe(view: View): string {
  const { snapshot } = view.result;
  const wind = Math.round(snapshot.windSpeedKmh);
  const humidity = Math.round(snapshot.humidity);
  const pressure = Math.round(snapshot.pressureHpa);
  const time = observedTime(snapshot.observedAt);
  const when = time ? ` at ${time} local time` : '';
  const origin =
    view.result.source === 'offline'
      ? 'This is the recorded offline sample.'
      : view.result.source === 'stale'
        ? 'This reading is a little older than usual.'
        : 'This reading is live from Open-Meteo.';

  return [
    `A generative painting of ${snapshot.city}${when}: ${snapshot.description.toLowerCase()},`,
    `${Math.round(snapshot.temperatureC)} degrees, ${humidity} percent humidity,`,
    `wind ${wind} kilometres per hour, ${pressure} hectopascals.`,
    `Painted in the ${view.scene.schoolName} manner from seed ${view.seed}.`,
    origin,
  ].join(' ');
}

function noteFor(view: View): string {
  if (view.result.note) return view.result.note;
  const time = observedTime(view.result.snapshot.observedAt);
  return time
    ? `${view.result.snapshot.city} · ${time} local`
    : `${view.result.snapshot.city} · a small weather`;
}

function stageMarkup(view: View): string {
  const { snapshot } = view.result;
  const temperature = Math.round(snapshot.temperatureC);
  return `
    <main class="atlas" data-ready="false" aria-describedby="atlas-description">
      <canvas class="atlas__canvas" aria-hidden="true"></canvas>
      <div class="atlas__scrim atlas__scrim--top" aria-hidden="true"></div>
      <div class="atlas__scrim atlas__scrim--bottom" aria-hidden="true"></div>
      <div class="atlas__veil" aria-hidden="true"></div>

      <header class="atlas__header">
        <div class="atlas__identity">
          <h1 class="atlas__wordmark">Atlas of Small Weathers</h1>
          <p class="atlas__tagline">A quiet engine for painting the sky above one place.</p>
          <div class="atlas__search-slot"></div>
        </div>
        <div class="atlas__meta">
          <div class="atlas__schools-slot"></div>
          <div class="atlas__seed-slot"></div>
        </div>
      </header>

      <footer class="atlas__footer">
        <div class="atlas__place">
          <h2 class="atlas__city">${escapeHtml(cityLabel(snapshot))}</h2>
          <p class="atlas__weather">
            <span class="atlas__condition">${escapeHtml(snapshot.description)}</span>
            <span class="atlas__degree">${temperature}°</span>
          </p>
        </div>
        <div class="atlas__footer-meta">
          <p class="atlas__note" aria-live="polite">${escapeHtml(noteFor(view))}</p>
          <div class="atlas__share-slot"></div>
        </div>
      </footer>

      <p class="visually-hidden" id="atlas-description">${escapeHtml(describe(view))}</p>
    </main>
  `;
}

function restMarkup(title: string, detail: string): string {
  return `
    <main class="boot">
      ${mark}
      <h1 class="boot__title">Atlas of Small Weathers</h1>
      <p class="boot__line">${escapeHtml(title)}</p>
      <p class="boot__detail">${escapeHtml(detail)}</p>
      <p class="boot__detail"><a class="boot__link" href="./">Open the opening sky</a></p>
    </main>
  `;
}

function sceneFor(result: WeatherResult, seed: number, school: SchoolPlugin | null): PaintingScene {
  return school
    ? createScene(result.snapshot, seed, school)
    : createHouseScene(result.snapshot, seed);
}

/**
 * Resolve the place named by the address bar.
 *
 * Exact restoration needs both coordinates. A link that names a curated city
 * without them still opens that city; anything else is incomplete, and saying
 * so is better than quietly painting Bogotá over it.
 */
function resolvePlace(state: UrlState): Place | null {
  const named = state.city !== null;
  if (!named && state.latitude === null && state.longitude === null) return DEFAULT_PLACE;
  if (state.latitude !== null && state.longitude !== null) {
    return {
      name: state.city ?? 'This place',
      latitude: state.latitude,
      longitude: state.longitude,
    };
  }
  if (state.city !== null) {
    const curated = CURATED_PLACES.find(
      (place) => normaliseQuery(place.name) === normaliseQuery(state.city ?? ''),
    );
    if (curated) return curated;
  }
  return null;
}

function shareState(view: View, mode: AtlasMode): ShareState {
  return {
    place: {
      name: view.place.name,
      latitude: view.place.latitude,
      longitude: view.place.longitude,
    },
    school: view.school?.meta.id ?? null,
    seed: view.seed,
    mode,
  };
}

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const url = readUrlState(window.location.search);
  const seed = normaliseSeed(url.seed ?? DEFAULT_SEED);
  const mode = url.mode;
  const still = mode === 'still';
  const frame = mode === 'frame';
  const warmupFrames = url.warmupFrames ?? 240;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * Schools are discovered once, at boot. A bad folder is reported and skipped;
   * it must never stop the atlas from opening. The URL can name a school, but an
   * unknown name falls back to the opening school instead of an empty canvas.
   */
  const discovery = getSchools();
  if (discovery.errors.length > 0) {
    console.warn(
      '[atlas] Some school folders could not be loaded:\n' +
        discovery.errors
          .map(
            (error) =>
              `  ${error.path}\n${error.issues.map((issue) => `    - ${issue}`).join('\n')}`,
          )
          .join('\n'),
    );
  }

  const activeSchool =
    findSchool(discovery.schools, url.school) ?? defaultSchool(discovery.schools) ?? null;
  const schoolName = activeSchool?.meta.name ?? 'House paper';

  if (url.school && activeSchool?.meta.id !== url.school) {
    console.warn(`[atlas] Unknown school "${url.school}"; opening ${schoolName}.`);
  }

  const initialPlace = resolvePlace(url);

  if (!initialPlace) {
    const name = url.city ?? 'this place';
    app.innerHTML = restMarkup(
      `The link names ${name}, but not its coordinates.`,
      'A shareable link always carries both. Ask for the painting again to get a complete one.',
    );
  } else {
    app.innerHTML = `
      <main class="boot" aria-busy="true">
        ${mark}
        <h1 class="boot__title">Atlas of Small Weathers</h1>
        <p class="boot__line">A quiet engine for painting the sky above one place.</p>
        <p class="boot__detail" aria-live="polite">Preparing the first wash · seed ${seed}</p>
      </main>
    `;

    const detail = app.querySelector<HTMLElement>('.boot__detail');

    void loadWeather(initialPlace, {
      offline: url.offline,
      // The recorded sample is Bogotá. It may open the default screen, but it
      // must never stand in for a different city someone explicitly asked for.
      fallbackToSample: samePlace(initialPlace, DEFAULT_PLACE),
    })
      .then((result) => {
        if (detail) detail.textContent = statusLine(result, seed);

        const firstView: View = {
          place: initialPlace,
          result,
          seed,
          school: activeSchool,
          scene: sceneFor(result, seed, activeSchool),
        };

        let view = firstView;
        app.innerHTML = stageMarkup(view);

        const stage = app.querySelector<HTMLElement>('.atlas');
        const initialCanvas = app.querySelector<HTMLCanvasElement>('.atlas__canvas');
        if (!stage || !initialCanvas) return;

        let canvas: HTMLCanvasElement = initialCanvas;
        let renderer: AtlasRenderer | null = null;
        let painter: CanvasPainter | null = null;
        let selector: SchoolSelector | null = null;
        let search: PlaceSearch | null = null;
        let stepper: SeedStepper | null = null;
        let switching = false;
        let loadingCity = false;
        let weatherRequest: AbortController | null = null;

        const veil = stage.querySelector<HTMLElement>('.atlas__veil');
        const busy = (): boolean => switching || loadingCity;

        const publishDebug = (renderMode: 'webgl' | 'fallback', stats?: unknown): void => {
          window.__atlas = {
            mode: renderMode,
            ready: stage.dataset.ready === 'true',
            school: view.scene.schoolId,
            schools: discovery.schools.map((school) => school.meta.id),
            seed: view.seed,
            city: view.result.snapshot.city,
            weather: view.result.snapshot.description,
            stats,
          };
        };

        const refreshUrl = (): void => {
          replaceUrlState(shareState(view, mode));
        };

        const syncStage = (): void => {
          const snapshot = view.result.snapshot;
          const city = stage.querySelector<HTMLElement>('.atlas__city');
          const condition = stage.querySelector<HTMLElement>('.atlas__condition');
          const degree = stage.querySelector<HTMLElement>('.atlas__degree');
          const note = stage.querySelector<HTMLElement>('.atlas__note');
          const description = document.getElementById('atlas-description');

          if (city) city.textContent = cityLabel(snapshot);
          if (condition) condition.textContent = snapshot.description;
          if (degree) degree.textContent = `${Math.round(snapshot.temperatureC)}°`;
          if (note) note.textContent = noteFor(view);
          if (description) description.textContent = describe(view);
          stepper?.setSeed(view.seed);
          publishDebug(renderer ? 'webgl' : 'fallback', window.__atlas?.stats);
        };

        const installScene = (scene: PaintingScene): void => {
          if (renderer) renderer.setScene(scene);
          else painter?.setScene(scene);
        };

        const setControlsBusy = (value: boolean): void => {
          selector?.setBusy(value);
          stepper?.setBusy(value);
          search?.setBusy(value);
        };

        const throughPaper = async (swap: () => void): Promise<void> => {
          if (veil) await crossfadeThroughPaper(veil, swap, reducedMotion.matches);
          else swap();
        };

        const painterOptions = {
          still,
          warmupFrames,
          reducedMotion: reducedMotion.matches,
          onReady: () => {
            stage.dataset.ready = 'true';
            publishDebug('fallback');
          },
        };

        const startFallback = (reason: string): void => {
          // A canvas that has held a WebGL context cannot become a 2D canvas, so
          // the fallback gets a fresh element. The old one is removed with it.
          renderer = null;
          painter?.dispose();
          const replacement = canvas.cloneNode(false) as HTMLCanvasElement;
          replacement.removeAttribute('data-atlas-mode');
          replacement.removeAttribute('data-atlas-ready');
          canvas.replaceWith(replacement);
          canvas = replacement;
          stage.dataset.mode = 'fallback';
          stage.dataset.reason = reason;
          painter = new CanvasPainter(replacement, view.scene, painterOptions);
          painter.start();
        };

        const applySchool = async (school: SchoolPlugin): Promise<void> => {
          if (busy() || school.meta.id === view.scene.schoolId) return;

          const nextScene = createScene(view.result.snapshot, view.seed, school);
          switching = true;
          setControlsBusy(true);

          const swap = (): void => {
            view = { ...view, school, scene: nextScene };
            installScene(nextScene);
            selector?.setActive(school.meta.id);
            syncStage();
            refreshUrl();
          };

          try {
            await throughPaper(swap);
          } finally {
            switching = false;
            setControlsBusy(false);
          }
        };

        const applySeed = async (nextSeed: number): Promise<void> => {
          const normalised = normaliseSeed(nextSeed);
          if (busy() || normalised === view.seed) {
            stepper?.setSeed(view.seed);
            return;
          }

          const nextScene = sceneFor(view.result, normalised, view.school);
          switching = true;
          setControlsBusy(true);

          const swap = (): void => {
            view = { ...view, seed: normalised, scene: nextScene };
            installScene(nextScene);
            syncStage();
            refreshUrl();
          };

          try {
            await throughPaper(swap);
          } finally {
            switching = false;
            setControlsBusy(false);
            stepper?.setSeed(view.seed);
          }
        };

        const applyPlace = async (
          place: Place,
          options: { force?: boolean } = {},
        ): Promise<void> => {
          if (options.force) {
            if (busy()) {
              search?.setPlace(view.place);
              return;
            }
          } else if (samePlace(place, view.place) || busy()) {
            search?.setPlace(view.place);
            return;
          }

          loadingCity = true;
          setControlsBusy(true);
          search?.setStatus(`Reading the sky over ${place.name}…`);
          weatherRequest?.abort();
          const request = new AbortController();
          weatherRequest = request;

          try {
            const nextResult = await loadWeather(place, {
              offline: url.offline,
              fallbackToSample: false,
              signal: request.signal,
            });
            if (request.signal.aborted) return;

            const nextScene = sceneFor(nextResult, view.seed, view.school);
            switching = true;
            await throughPaper(() => {
              view = {
                ...view,
                place,
                result: nextResult,
                scene: nextScene,
              };
              installScene(nextScene);
              syncStage();
              refreshUrl();
            });
            search?.setPlace(place);
            search?.setStatus('');
          } catch {
            if (request.signal.aborted) return;
            // The previous painting stays exactly as it was. A missing reading
            // is a sentence, not a different city.
            search?.setPlace(view.place);
            search?.setStatus(
              `No reading for ${place.name} just now. Still painting ${view.result.snapshot.city}.`,
            );
          } finally {
            if (weatherRequest === request) weatherRequest = null;
            switching = false;
            loadingCity = false;
            setControlsBusy(false);
          }
        };

        const schoolSlot = stage.querySelector<HTMLElement>('.atlas__schools-slot');
        if (schoolSlot) {
          if (discovery.schools.length > 0) {
            selector = createSchoolSelector({
              schools: discovery.schools,
              activeId: view.scene.schoolId,
              onChange: (school) => {
                void applySchool(school);
              },
            });
            schoolSlot.append(selector.element);
          } else {
            schoolSlot.innerHTML = `<p class="atlas__school atlas__school--static">${view.scene.schoolName}</p>`;
          }
        }

        const seedSlot = stage.querySelector<HTMLElement>('.atlas__seed-slot');
        if (seedSlot) {
          stepper = createSeedStepper({
            seed: view.seed,
            onChange: (nextSeed) => {
              void applySeed(nextSeed);
            },
          });
          seedSlot.append(stepper.element);
        }

        const searchSlot = stage.querySelector<HTMLElement>('.atlas__search-slot');
        if (searchSlot) {
          search = createPlaceSearch({
            initialPlace: view.place,
            offline: url.offline,
            onSelect: (place) => {
              void applyPlace(place);
            },
          });
          searchSlot.append(search.element);
        }

        const shareSlot = stage.querySelector<HTMLElement>('.atlas__share-slot');
        if (shareSlot) {
          shareSlot.append(
            createShareButton({
              getState: () => shareState(view, mode),
            }).element,
          );
        }

        createIdle({
          root: stage,
          isBusy: () => busy() || search?.element.dataset.open === 'true',
          reducedMotion,
        });

        if (frame) {
          stage.classList.add('atlas--frame');
          void document.documentElement.requestFullscreen?.().catch(() => undefined);
          if ('wakeLock' in navigator) {
            void (
              navigator as Navigator & {
                wakeLock?: { request: (type: string) => Promise<unknown> };
              }
            ).wakeLock
              ?.request('screen')
              .catch(() => undefined);
          }
          window.setInterval(
            () => {
              void applyPlace(view.place, { force: true });
            },
            10 * 60 * 1000,
          );
        }

        refreshUrl();
        publishDebug('fallback');

        try {
          const created = new AtlasRenderer(canvas, view.scene, {
            still,
            warmupFrames,
            reducedMotion: reducedMotion.matches,
            onReady: (stats) => {
              stage.dataset.ready = 'true';
              publishDebug('webgl', stats);
            },
            onStats: (stats) => {
              stage.dataset.fps = String(stats.fps);
              if (window.__atlas) window.__atlas = { ...window.__atlas, stats };
            },
            onContextLost: (reason) => {
              created.dispose();
              if (renderer === created) renderer = null;
              startFallback(reason);
            },
          });
          renderer = created;
          stage.dataset.mode = 'webgl';
          created.start();
        } catch (error) {
          startFallback(error instanceof Error ? error.message : String(error));
        }
      })
      .catch((error: unknown) => {
        if (!app.querySelector('.boot')) return;
        const name = initialPlace.name;
        const detail =
          error instanceof Error && error.message
            ? `${error.message}. The paper is ready; the sky is not.`
            : 'The paper is ready; the sky is not.';
        app.innerHTML = restMarkup(`No weather reading for ${name} just now.`, detail);
      });
  }
}
