const { test, expect } = require('@playwright/test');

async function boot(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function assertNoWorkspaceOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#map')).toBeVisible();
}

test('desktop and laptop workspace keep map-first layout and accessible controls', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await boot(page, viewport);
    await assertNoWorkspaceOverflow(page);
    await expect(page.locator('#workspace-panel')).toBeVisible();
    const unnamedIconButtons = await page.locator('button').evaluateAll(buttons => buttons.filter(button => !button.textContent.trim() && !button.getAttribute('aria-label') && !button.getAttribute('title')).length);
    expect(unnamedIconButtons).toBe(0);
    await page.locator('#toggle-search-btn').focus();
    await expect(page.locator('#toggle-search-btn')).toBeFocused();
  }
});

test('tablet and mobile can collapse the workspace without losing primary map controls', async ({ page }) => {
  await boot(page, { width: 900, height: 900 });
  await assertNoWorkspaceOverflow(page);
  await expect(page.locator('#workspace-panel')).toBeVisible();
  await expect(page.locator('#workspace-close-btn')).toBeVisible();

  await boot(page, { width: 390, height: 844 });
  await assertNoWorkspaceOverflow(page);
  await page.locator('#workspace-close-btn').click();
  await expect(page.locator('#workspace-panel')).toHaveClass(/workspace-panel-collapsed/);
  await expect(page.locator('#workspace-toggle-btn')).toBeVisible();
  await expect(page.locator('#controls-container')).toBeVisible();
  await page.locator('#workspace-toggle-btn').click();
  await expect(page.locator('#workspace-panel')).not.toHaveClass(/workspace-panel-collapsed/);
});

