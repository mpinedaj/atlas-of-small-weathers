import './styles/index.css';

const mark = `
  <svg class="boot__mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <path fill="currentColor" opacity=".94"
      d="M74.4 27.9c7 8.1 8.3 20.8 1.7 30.1-6.6 9.4-19.8 12.4-31.7 13.3-11.9.9-24.1-1.9-29.7-9.6-5.6-7.7-3.7-19.8 3.3-29.4C24.9 22.7 36.4 16.8 47.5 18c11.1 1.2 19.9 1.8 26.9 9.9Z"/>
    <path fill="var(--ink)" opacity=".16"
      d="M30.4 61.6c9.2-11.4 23.4-18.6 39.5-18.3-9.3 15.4-23.7 24.5-39.5 24.3Z"/>
  </svg>
`;

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main class="boot" aria-busy="true">
      ${mark}
      <h1 class="boot__title">Atlas of Small Weathers</h1>
      <p class="boot__line">A quiet engine for painting the sky above one place.</p>
      <p class="boot__detail">Preparing the first wash &middot; seed 1844</p>
    </main>
  `;
}
