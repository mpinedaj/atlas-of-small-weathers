import { expect, test } from '@playwright/test';

test.describe('boot', () => {
  test('shows the title and the opening wash without console errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page: ${error.message}`));

    await page.goto('/');

    await expect(page).toHaveTitle(/Atlas of Small Weathers/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atlas of Small Weathers');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(/painting the sky above one place/i)).toBeVisible();

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
