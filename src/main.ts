import './styles/index.css';

import type { WeatherSnapshot } from './core/types';
import { DEFAULT_SEED, normaliseSeed } from './core/seed';
import { DEFAULT_PLACE, loadWeather } from './data';
import type { WeatherResult } from './data';
import { CanvasPainter } from './gl/fallback';
import { AtlasRenderer } from './gl/renderer';
import { createHouseScene, createScene } from './gl/scene';
import type { PaintingScene } from './gl/scene';
import { defaultSchool, findSchool, getSchools } from './schools/registry';
import type { SchoolPlugin } from './schools/registry';
import { crossfadeThroughPaper } from './ui/paper';
import { createSchoolSelector } from './ui/schools';
import type { SchoolSelector } from './ui/schools';
import { replaceSearchParam } from './ui/url';

/**
 * The opening screen, and the hand-off between weather and painting.
 *
 * Everything visible here is one of two states: paper while the weather loads,
 * or the painting once it has arrived. The painting is the page; the interface
 * sits on its edges. A textual description carries the same information for
 * screen readers and for anyone who cannot see the canvas.
 */

const mark = `
  <svg class="boot__mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <path fill="currentColor" opacity=".94"
      d="M74.4 27.9c7 8.1 8.3 20.8 1.7 30.1-6.6 9.4-19.8 12.4-31.7 13.3-11.9.9-24.1-1.9-29.7-9.6-5.6-7.7-3.7-19.8 3.3-29.4C24.9 22.7 36.4 16.8 47.5 18c11.1 1.2 19.9 1.8 26.9 9.9Z"/>
    <path fill="var(--ink)" opacity=".16"
      d="M30.4 61.6c9.2-11.4 23.4-18.6 39.5-18.3-9.3 15.4-23.7 24.5-39.5 24.3Z"/>
  </svg>
`;

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

/** The same painting, told in words. */
function describe(
  snapshot: WeatherSnapshot,
  seed: number,
  source: string,
  schoolName: string,
): string {
  const wind = Math.round(snapshot.windSpeedKmh);
  const humidity = Math.round(snapshot.humidity);
  const pressure = Math.round(snapshot.pressureHpa);
  const time = observedTime(snapshot.observedAt);
  const when = time ? ` at ${time} local time` : '';
  const origin =
    source === 'offline'
      ? 'This is the recorded offline sample.'
      : source === 'stale'
        ? 'This reading is a little older than usual.'
        : 'This reading is live from Open-Meteo.';

  return [
    `A generative painting of ${snapshot.city}${when}: ${snapshot.description.toLowerCase()},`,
    `${Math.round(snapshot.temperatureC)} degrees, ${humidity} percent humidity,`,
    `wind ${wind} kilometres per hour, ${pressure} hectopascals.`,
    `Painted in the ${schoolName} manner from seed ${seed}.`,
    origin,
  ].join(' ');
}

function stageMarkup(
  snapshot: WeatherSnapshot,
  seed: number,
  note: string | null,
  source: string,
  schoolName: string,
): string {
  const temperature = Math.round(snapshot.temperatureC);
  const place = snapshot.country ? `${snapshot.city}, ${snapshot.country}` : snapshot.city;
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
        </div>
        <div class="atlas__meta">
          <div class="atlas__schools-slot"></div>
          <p class="atlas__seed"><span>seed</span> ${seed}</p>
        </div>
      </header>

      <footer class="atlas__footer">
        <div class="atlas__place">
          <h2 class="atlas__city">${place}</h2>
          <p class="atlas__weather">
            <span class="atlas__condition">${snapshot.description}</span>
            <span class="atlas__degree">${temperature}°</span>
          </p>
        </div>
        <p class="atlas__note" aria-live="polite">${note ?? `${snapshot.city} · ${observedTime(snapshot.observedAt)} local`}</p>
      </footer>

      <p class="visually-hidden" id="atlas-description">${describe(snapshot, seed, source, schoolName)}</p>
    </main>
  `;
}

const params = new URLSearchParams(window.location.search);
const app = document.querySelector<HTMLDivElement>('#app');

const requestedSeed = params.get('seed');
const seed = normaliseSeed(requestedSeed === null ? DEFAULT_SEED : Number(requestedSeed));
const still = params.has('still');
const warmupFrames = Number(params.get('warmup') ?? 240);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const offline = params.has('offline');

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
          (error) => `  ${error.path}\n${error.issues.map((issue) => `    - ${issue}`).join('\n')}`,
        )
        .join('\n'),
  );
}

const requestedSchool = params.get('school');
const activeSchool =
  findSchool(discovery.schools, requestedSchool) ?? defaultSchool(discovery.schools);
const schoolName = activeSchool?.meta.name ?? 'House paper';

if (requestedSchool && activeSchool?.meta.id !== requestedSchool) {
  console.warn(`[atlas] Unknown school "${requestedSchool}"; opening ${schoolName}.`);
}

function setDebugState(
  stage: HTMLElement,
  scene: PaintingScene,
  snapshot: WeatherSnapshot,
  mode: 'webgl' | 'fallback',
  stats?: unknown,
): void {
  window.__atlas = {
    mode,
    ready: stage.dataset.ready === 'true',
    school: scene.schoolId,
    schools: discovery.schools.map((school) => school.meta.id),
    seed,
    city: snapshot.city,
    weather: snapshot.description,
    stats,
  };
}

if (app) {
  app.innerHTML = `
    <main class="boot" aria-busy="true">
      ${mark}
      <h1 class="boot__title">Atlas of Small Weathers</h1>
      <p class="boot__line">A quiet engine for painting the sky above one place.</p>
      <p class="boot__detail" aria-live="polite">Preparing the first wash · seed ${seed}</p>
    </main>
  `;

  const detail = app.querySelector<HTMLElement>('.boot__detail');

  void loadWeather(DEFAULT_PLACE, { offline })
    .then((result) => {
      if (detail) detail.textContent = statusLine(result, seed);

      let currentScene = activeSchool
        ? createScene(result.snapshot, seed, activeSchool)
        : createHouseScene(result.snapshot, seed);
      app.innerHTML = stageMarkup(
        result.snapshot,
        seed,
        result.note ?? null,
        result.source,
        currentScene.schoolName,
      );
      const stage = app.querySelector<HTMLElement>('.atlas');
      const initialCanvas = app.querySelector<HTMLCanvasElement>('.atlas__canvas');
      if (!stage || !initialCanvas) return;

      let canvas: HTMLCanvasElement = initialCanvas;
      let renderer: AtlasRenderer | null = null;
      let painter: CanvasPainter | null = null;
      let selector: SchoolSelector | null = null;
      let switching = false;

      const veil = stage.querySelector<HTMLElement>('.atlas__veil');

      const refreshDescription = (): void => {
        const description = document.getElementById('atlas-description');
        if (description) {
          description.textContent = describe(
            result.snapshot,
            seed,
            result.source,
            currentScene.schoolName,
          );
        }
      };

      const painterOptions = {
        still,
        warmupFrames,
        reducedMotion: reducedMotion.matches,
        onReady: () => {
          stage.dataset.ready = 'true';
          setDebugState(stage, currentScene, result.snapshot, 'fallback');
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
        painter = new CanvasPainter(replacement, currentScene, painterOptions);
        painter.start();
      };

      const applySchool = async (school: SchoolPlugin): Promise<void> => {
        if (switching || school.meta.id === currentScene.schoolId) return;

        const nextScene = createScene(result.snapshot, seed, school);
        switching = true;
        selector?.setBusy(true);

        const swap = (): void => {
          currentScene = nextScene;
          if (renderer) renderer.setScene(nextScene);
          else startFallback('school change');
          selector?.setActive(school.meta.id);
          refreshDescription();
          replaceSearchParam('school', school.meta.id);
          if (window.__atlas) window.__atlas = { ...window.__atlas, school: school.meta.id };
        };

        try {
          if (veil) await crossfadeThroughPaper(veil, swap, reducedMotion.matches);
          else swap();
        } finally {
          switching = false;
          selector?.setBusy(false);
        }
      };

      const schoolSlot = stage.querySelector<HTMLElement>('.atlas__schools-slot');
      if (schoolSlot) {
        if (discovery.schools.length > 0) {
          selector = createSchoolSelector({
            schools: discovery.schools,
            activeId: currentScene.schoolId,
            onChange: (school) => {
              void applySchool(school);
            },
          });
          schoolSlot.append(selector.element);
        } else {
          schoolSlot.innerHTML = `<p class="atlas__school atlas__school--static">${currentScene.schoolName}</p>`;
        }
      }

      try {
        const created = new AtlasRenderer(canvas, currentScene, {
          still,
          warmupFrames,
          reducedMotion: reducedMotion.matches,
          onReady: (stats) => {
            stage.dataset.ready = 'true';
            setDebugState(stage, currentScene, result.snapshot, 'webgl', stats);
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
    .catch(() => {
      if (app.querySelector('.boot')) {
        app.innerHTML = `
          <main class="boot">
            ${mark}
            <h1 class="boot__title">Atlas of Small Weathers</h1>
            <p class="boot__line">The weather is resting. The paper is ready.</p>
            <p class="boot__detail">Try again in a moment.</p>
          </main>
        `;
      }
    });
}
