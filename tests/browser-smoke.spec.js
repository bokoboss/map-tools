const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test('desktop app shell renders its core controls', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#toggle-search-btn')).toBeVisible();
  await page.locator('#toggle-tool-panel-btn').click();
  await expect(page.locator('#save-btn')).toBeVisible();
  await expect(page.locator('#open-btn')).toBeVisible();
  await expect(page.locator('#draw-arrow-btn')).toBeVisible();
  await expect(page.locator('#add-text-btn')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('security fixture renders project text literally without executing it', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#file-input').setInputFiles({
    name: 'project-v2-security-text.json',
    mimeType: 'application/json',
    buffer: fs.readFileSync('docs/v2/fixtures/project-v2-security-text.json')
  });
  const textLabel = page.locator('.text-label-icon');
  await expect(textLabel).toContainText('<script>window.__MAP_TOOLS_XSS__=true</script>');
  await expect(textLabel.locator('script')).toHaveCount(0);
  await expect(textLabel.locator('[onload]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__MAP_TOOLS_XSS__)).toBeUndefined();
});

test('mixed v2 fixture renders every semantic feature type', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#file-input').setInputFiles({
    name: 'project-v2-mixed.json',
    mimeType: 'application/json',
    buffer: fs.readFileSync('docs/v2/fixtures/project-v2-mixed.json')
  });
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
