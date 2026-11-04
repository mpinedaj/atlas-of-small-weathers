import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const KYOTO_KEY = 'atlas:v1:weather:35.012:135.768:kyoto';

const KYOTO_READING = {
  city: 'Kyoto',
  country: 'Japan',
  admin1: 'Kyoto',
  latitude: 35.0116,
  longitude: 135.7681,
  elevationM: 55,
  timezone: 'Asia/Tokyo',
  observedAt: '2026-11-02T12:45',
  temperatureC: 12.4,
  apparentTemperatureC: 11.2,
  humidity: 60,
  cloudCover: 20,
  pressureHpa: 1015,
  precipitationMm: 0,
  windSpeedKmh: 8,
  windDirectionDeg: 180,
  isDay: true,
  weatherCode: 0,
  condition: 'clear',
  description: 'Clear sky',
  baselineTemperatureC: 14,
  warmth: -0.1,
};

async function seedKyoto(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, reading }) => {
      const entry = {
        v: 1,
        storedAt: Date.now(),
        ttlMs: 10 * 60 * 1000,
        value: reading,
      };
      window.localStorage.setItem(key, JSON.stringify(entry));
    },
    { key: KYOTO_KEY, reading: KYOTO_READING },
  );
}

async function waitForPainting(page: Page): Promise<void> {
  await expect(page.locator('.atlas')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
}

/** A quiet painting fades its label; any key is enough to bring it back. */
async function wake(page: Page): Promise<void> {
  await page.keyboard.press('Shift');
  await expect(page.locator('.atlas')).toHaveAttribute('data-idle', 'false');
}

test.describe('URL state', () => {
  test('restores city, school and seed exactly, across a reload', async ({ page }) => {
    await seedKyoto(page);
    await page.goto(
      '/?offline=1&still=1&warmup=30&city=Kyoto&lat=35.0116&lon=135.7681&school=rothko&seed=88',
    );
    await waitForPainting(page);

    await expect(page.locator('.atlas__city')).toHaveText('Kyoto, Japan');
    await expect(page.getByRole('button', { name: 'Rothko' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.atlas__seed-value')).toHaveText('88');

    const state = await page.evaluate(() => window.__atlas);
    expect(state).toMatchObject({ city: 'Kyoto', seed: 88, school: 'rothko' });

    await expect(page).toHaveURL(/city=Kyoto/);
    await expect(page).toHaveURL(/lat=35\.0116/);
    await expect(page).toHaveURL(/lon=135\.7681/);
    await expect(page).toHaveURL(/school=rothko/);
    await expect(page).toHaveURL(/seed=88/);
    await expect(page).toHaveURL(/mode=still/);

    await page.reload();
    await waitForPainting(page);
    await expect(page.locator('.atlas__city')).toHaveText('Kyoto, Japan');
    expect(await page.evaluate(() => window.__atlas)).toMatchObject({
      city: 'Kyoto',
      seed: 88,
      school: 'rothko',
    });
  });
});

test.describe('city search', () => {
  test('opens with /, filters with the keyboard and paints the chosen place', async ({ page }) => {
    await seedKyoto(page);
    await page.goto('/?offline=1&still=1&warmup=30');
    await waitForPainting(page);

    await page.keyboard.press('/');
    const input = page.getByRole('combobox', { name: 'Search for a place' });
    await expect(input).toBeFocused();

    await input.fill('kyo');
    const option = page.getByRole('option', { name: /Kyoto/ });
    await expect(option).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page.locator('.atlas__city')).toHaveText('Kyoto, Japan');
    await expect(page).toHaveURL(/city=Kyoto/);
    await expect(page).toHaveURL(/school=turner/);
    await expect(page.locator('#atlas-description')).toContainText('Kyoto');
    expect(await page.evaluate(() => window.__atlas)).toMatchObject({ city: 'Kyoto' });
  });
});

test.describe('seed stepper', () => {
  test('steps the seed, updates the URL and keeps the canvas', async ({ page }) => {
    await page.goto('/?offline=1&still=1&warmup=30&seed=1844&school=turner');
    await waitForPainting(page);
    await wake(page);

    await page.getByRole('button', { name: 'Next seed' }).click();

    await expect(page.locator('.atlas__seed-value')).toHaveText('1845');
    await expect(page).toHaveURL(/seed=1845/);
    await expect(page.locator('#atlas-description')).toContainText('seed 1845');
    await page.waitForFunction(() => window.__atlas?.seed === 1845);
    await expect(page.locator('.atlas')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('canvas')).toHaveCount(1);
  });
});

test.describe('share', () => {
  test('copies a canonical URL without the test switches', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:5173',
    });
    await page.goto('/?offline=1&still=1&warmup=30&seed=1844&school=turner');
    await waitForPainting(page);
    await wake(page);

    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(copied);

    expect(url.searchParams.get('city')).toBe('Bogotá');
    expect(url.searchParams.get('lat')).toBe('4.6097');
    expect(url.searchParams.get('lon')).toBe('-74.0817');
    expect(url.searchParams.get('seed')).toBe('1844');
    expect(url.searchParams.get('school')).toBe('turner');
    expect(url.searchParams.get('mode')).toBe('still');
    expect(url.searchParams.has('offline')).toBe(false);
    expect(url.searchParams.has('warmup')).toBe(false);
    expect(url.hash).toBe('');
  });
});

test.describe('idle', () => {
  test('fades the label after a quiet moment and wakes on a key', async ({ page }) => {
    await page.goto('/?offline=1&still=1&warmup=30');
    await waitForPainting(page);
    const stage = page.locator('.atlas');

    await expect(stage).toHaveAttribute('data-idle', 'true', { timeout: 12_000 });
    await expect(page.locator('.atlas__header')).toHaveCSS('opacity', '0');

    await page.keyboard.press('Shift');
    await expect(stage).toHaveAttribute('data-idle', 'false');
    await expect(page.locator('.atlas__header')).toHaveCSS('opacity', '1');
  });
});
