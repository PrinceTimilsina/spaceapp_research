import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('navigation reaches every page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /PROJECT\s*ASTRA/ })).toBeVisible();
  const pages: [string, RegExp][] = [
    ['Map', /Layers/],
    ['Terrain', /Terrain intelligence/],
    ['Science', /Science guide/],
    ['Planner', /Mission route planner/],
    ['Environment', /Mission context/],
    ['Field guide', /Mission field guide/],
    ['Data & limits', /Data, provenance/],
  ];
  for (const [link, heading] of pages) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: link }).click();
    await expect(page.getByText(heading).first()).toBeVisible();
  }
});

test('map renders and layer toggles change state', async ({ page }) => {
  await page.goto('/#/map');
  await expect(page.locator('.ol-viewport canvas').first()).toBeVisible();
  const slope = page.locator('#layer-slope');
  await expect(slope).not.toBeChecked();
  await slope.check();
  await expect(slope).toBeChecked();
  await page.getByRole('button', { name: 'Octavia E. Butler Landing' }).click();
  await expect(page.getByRole('heading', { name: /Octavia E\. Butler Landing/ })).toBeVisible();
});

test('planner computes routes, labels simulated terrain, and compares return', async ({ page }) => {
  await page.goto('/#/planner');
  await expect(page.getByText('Routes are computed on SIMULATED terrain')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Outbound strategies' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Outbound vs return/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Shortest', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Return (re-planned)' })).toBeVisible();
  // Adjusting the slope limit re-plans without errors.
  await page.getByLabel(/Max edge slope/).fill('12');
  await expect(page.getByRole('heading', { name: 'Outbound strategies' })).toBeVisible();
});

test('field guide has printable content and a working download', async ({ page }) => {
  await page.goto('/#/field-guide');
  await expect(page.getByRole('heading', { name: /Jezero Crater hypothetical traverse/ })).toBeVisible({ timeout: 20_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download plan data/ }).click()]);
  expect(dl.suggestedFilename()).toBe('astra-mission-plan.json');
});
