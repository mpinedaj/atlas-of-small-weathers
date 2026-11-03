import { expect, test } from '@playwright/test';

test.describe('boot', () => {
  test('shows the title and the opening wash without console errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page: ${error.message}`));

    await page.goto('/?offline=1');

    await expect(page).toHaveTitle(/Atlas of Small Weathers/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atlas of Small Weathers');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(/painting the sky above one place/i)).toBeVisible();
    await expect(page.locator('.atlas__note')).toContainText(/Offline sample/i);

    expect(problems).toEqual([]);
  });

  test('serves the manifest and favicon', async ({ request }) => {
    const manifest = await request.get('/site.webmanifest');
    expect(manifest.ok()).toBe(true);
    expect(manifest.headers()['content-type']).toContain('json');

    const favicon = await request.get('/favicon.svg');
    expect(favicon.ok()).toBe(true);
  });
});

test.describe('painting', () => {
  test('renders a still frame in WebGL with visible variation and no console errors', async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page: ${error.message}`));

    await page.goto('/?offline=1&still=1&warmup=120');
    const stage = page.locator('.atlas');
    await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
    await expect(stage).toHaveAttribute('data-mode', 'webgl');

    const state = await page.evaluate(() => window.__atlas);
    expect(state?.mode).toBe('webgl');
    expect(state?.seed).toBe(1844);

    const signature = await page.evaluate(() => {
      const source = document.querySelector('canvas');
      if (!(source instanceof HTMLCanvasElement)) return null;
      const sample = document.createElement('canvas');
      sample.width = 64;
      sample.height = 40;
      const context = sample.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(source, 0, 0, sample.width, sample.height);
      const { data } = context.getImageData(0, 0, sample.width, sample.height);
      const luminance: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        luminance.push(0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!);
      }
      const mean = luminance.reduce((total, value) => total + value, 0) / luminance.length;
      const min = Math.min(...luminance);
      const max = Math.max(...luminance);
      const buckets = new Set(luminance.map((value) => Math.floor(value / 24))).size;
      return { mean, min, max, buckets };
    });

    expect(signature).not.toBeNull();
    expect(signature!.mean).toBeGreaterThan(8);
    expect(signature!.mean).toBeLessThan(250);
    expect(signature!.max - signature!.min).toBeGreaterThan(12);
    expect(signature!.buckets).toBeGreaterThan(3);
    expect(problems).toEqual([]);
  });

  test('opens the Turner school from the URL', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page: ${error.message}`));

    await page.goto('/?offline=1&still=1&warmup=90&school=turner');
    const stage = page.locator('.atlas');
    await expect(stage).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
    await expect(stage).toHaveAttribute('data-mode', 'webgl');
    await expect(page.locator('.atlas__school')).toHaveText('Turner');

    const state = await page.evaluate(() => window.__atlas);
    expect(state?.school).toBe('turner');
    expect(state?.schools).toContain('turner');
    expect(state?.stats).toMatchObject({ degraded: [] });
    expect(problems).toEqual([]);
  });

  test('falls back to the opening school for an unknown id', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page: ${error.message}`));

    await page.goto('/?offline=1&still=1&warmup=90&school=does-not-exist');
    await expect(page.locator('.atlas')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });

    const state = await page.evaluate(() => window.__atlas);
    expect(state?.school).toBe('turner');
    expect(problems).toEqual([]);
  });
});
