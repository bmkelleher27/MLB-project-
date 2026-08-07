import { expect, test, type Page } from '@playwright/test';

/** Aaron Judge — a stable, always-present id to hang structural assertions on. */
const PLAYER_ID = 592450;

/**
 * Collects application errors from the page.
 *
 * Third-party *resource* failures are excluded on purpose: team logos come from
 * an MLB CDN, and a flaky image fetch is not a defect in this app — asserting
 * on it would make every test hostage to someone else's uptime. Script errors
 * and thrown exceptions are always collected.
 */
function collectAppErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/Failed to load resource/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

test.describe('app shell', () => {
  test('landing page renders the schedule and a working search box', async ({ page }) => {
    const errors = collectAppErrors(page);
    await page.goto('/');

    await expect(page.locator('.landing-title')).toBeVisible();
    await expect(page.locator('.player-search-input')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('an unknown route shows a not-found page, not a blank one', async ({ page }) => {
    await page.goto('/definitely-not-a-route');
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByText('Page not found')).toBeVisible();
    // …and offers a way back rather than stranding the reader.
    await expect(page.getByRole('link', { name: /Back to today/ })).toBeVisible();
  });
});

test.describe('player search', () => {
  test('typing a name navigates to that player', async ({ page }) => {
    const errors = collectAppErrors(page);
    await page.goto('/');

    await page.fill('.player-search-input', 'ohtani');
    await page.waitForSelector('.player-search-item');
    await page.locator('.player-search-item').first().click();

    await expect(page).toHaveURL(/\/player\/\d+/);
    await expect(page.locator('.player-header h1')).toContainText(/\w/);
    expect(errors).toEqual([]);
  });

  test('a search with no matches says so instead of hanging', async ({ page }) => {
    await page.goto('/');
    await page.fill('.player-search-input', 'zzzzqqqxyz');
    await expect(page.locator('.player-search-empty')).toBeVisible();
  });
});

test.describe('player profile', () => {
  test('renders the pitch mix, zone grid and trend chart', async ({ page }) => {
    const errors = collectAppErrors(page);
    await page.goto(`/player/${PLAYER_ID}`);

    // Usage bars, one row per pitch type.
    await expect(page.locator('.mix-figure')).toBeVisible();
    expect(await page.locator('.mix-row').count()).toBeGreaterThan(1);

    // The Gameday grid always has exactly 13 cells, whatever the data says.
    await expect(page.locator('.zone-plot')).toBeVisible();
    expect(await page.locator('.zone-rect').count()).toBe(13);

    await expect(page.locator('.trend-figure')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every chart offers a table view, so no value is color- or hover-only', async ({ page }) => {
    await page.goto(`/player/${PLAYER_ID}`);
    await page.waitForSelector('.zone-plot');

    const toggles = page.locator('.viz-table-toggle summary');
    expect(await toggles.count()).toBeGreaterThanOrEqual(2);

    await toggles.first().click();
    await expect(page.locator('.viz-table').first()).toBeVisible();
  });

  test('switching tabs shows the game log', async ({ page }) => {
    await page.goto(`/player/${PLAYER_ID}`);
    await page.waitForSelector('.player-tabs');

    await page.getByRole('tab', { name: 'Game log' }).click();
    await expect(page.locator('#panel-log')).toBeVisible();
    await expect(page.locator('.player-log-table').first()).toBeVisible();
  });

  test('surfaces an error with a retry when the profile request fails', async ({ page }) => {
    // The regression this guards: the failure used to render an empty panel.
    await page.route('**/api/player/*/profile*', (r) =>
      r.fulfill({ status: 502, body: '{"error":"upstream down"}' })
    );
    await page.goto(`/player/${PLAYER_ID}`);

    await expect(page.locator('.status-error')).toContainText(/Couldn’t load pitch trends/);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test.describe('scorecard', () => {
  test('opening a game from the schedule renders a scorecard or its preview', async ({ page }) => {
    await page.goto('/');
    const firstGame = page.locator('a[href^="/game/"]').first();
    test.skip((await firstGame.count()) === 0, 'no games scheduled today');

    await firstGame.click();
    await expect(page).toHaveURL(/\/game\/\d+/);
    // Either a live/final scorecard or a pregame preview is a pass; a blank
    // page or an error message is not.
    await expect(page.locator('.scorecard-page, .preview-page')).toBeVisible();
  });
});

test.describe('backend contract', () => {
  test('health reports cache occupancy so memory pressure is observable', async ({ request }) => {
    const res = await request.get('http://localhost:4000/healthz');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.cache).toHaveProperty('megabytes');
    expect(body.cache.megabytes).toBeLessThanOrEqual(body.cache.budgetMegabytes);
  });

  test('an unknown API path returns JSON, not an HTML error page', async ({ request }) => {
    const res = await request.get('http://localhost:4000/api/definitely-not-real');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
  });
});
