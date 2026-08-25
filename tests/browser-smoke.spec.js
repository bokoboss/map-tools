const { test, expect } = require('@playwright/test');

test('desktop app shell renders its core controls', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#toggle-search-btn')).toBeVisible();
  await page.locator('#toggle-tool-panel-btn').click();
  await expect(page.locator('#save-btn')).toBeVisible();
  await expect(page.locator('#open-btn')).toBeVisible();
  await expect(page.locator('#draw-arrow-btn')).toBeVisible();
  await expect(page.locator('#add-text-btn')).toBeVisible();
});
