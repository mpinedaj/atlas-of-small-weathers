import { defineConfig } from 'vite';

// Relative base keeps the build portable: GitHub Pages, a static host, or a
// folder opened from disk all resolve assets correctly.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
