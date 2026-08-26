const { test, expect } = require('@playwright/test');

test('normal production route does not expose test-only globals', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  const globals = await page.evaluate(() => ({
    mapToolsTest: typeof window.__mapToolsTest,
    schemaGlobal: typeof window.MapToolsSchema
  }));
  expect(globals).toEqual({ mapToolsTest: 'undefined', schemaGlobal: 'undefined' });
});
