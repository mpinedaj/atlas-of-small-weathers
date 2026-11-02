import './styles/index.css';

import { DEFAULT_PLACE, loadWeather } from './data';
import type { WeatherResult } from './data';

const mark = `
  <svg class="boot__mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <path fill="currentColor" opacity=".94"
      d="M74.4 27.9c7 8.1 8.3 20.8 1.7 30.1-6.6 9.4-19.8 12.4-31.7 13.3-11.9.9-24.1-1.9-29.7-9.6-5.6-7.7-3.7-19.8 3.3-29.4C24.9 22.7 36.4 16.8 47.5 18c11.1 1.2 19.9 1.8 26.9 9.9Z"/>
    <path fill="var(--ink)" opacity=".16"
      d="M30.4 61.6c9.2-11.4 23.4-18.6 39.5-18.3-9.3 15.4-23.7 24.5-39.5 24.3Z"/>
  </svg>
`;

function statusLine(result: WeatherResult): string {
  if (result.source === 'offline' && result.note) return result.note;

  const temperature = Math.round(result.snapshot.temperatureC);
  const observed = result.source === 'stale' ? ' · earlier reading' : '';
  return `${result.snapshot.description}, ${temperature}° in ${result.snapshot.city}${observed} · seed 1844`;
}

const params = new URLSearchParams(window.location.search);
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main class="boot" aria-busy="true">
      ${mark}
      <h1 class="boot__title">Atlas of Small Weathers</h1>
      <p class="boot__line">A quiet engine for painting the sky above one place.</p>
      <p class="boot__detail" aria-live="polite">Preparing the first wash · seed 1844</p>
    </main>
  `;

  const detail = app.querySelector<HTMLElement>('.boot__detail');
  void loadWeather(DEFAULT_PLACE, { offline: params.has('offline') })
    .then((result) => {
      if (detail) detail.textContent = statusLine(result);
    })
    .catch(() => {
      if (detail) detail.textContent = 'The weather is resting. The paper is ready.';
    });
}
