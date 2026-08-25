const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const mixedFixture = fs.readFileSync('docs/v2/fixtures/project-v2-mixed.json');

async function boot(page) {
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function loadFixture(page) {
  await page.locator('#file-input').setInputFiles({ name: 'history-fixture.json', mimeType: 'application/json', buffer: mixedFixture });
  await expect.poll(() => page.locator('.workspace-feature-row').count()).toBe(1 + 6);
}

test('selection is UI-only, feature edits are undoable, and saved baseline is restorable', async ({ page }) => {
  await boot(page);
  await loadFixture(page);
  const markerRow = page.locator('.workspace-feature-row[data-feature-id="marker-tmc-01"]');
  await markerRow.locator('[data-action="select-feature"]').click();
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);

  await page.locator('#inspector-name').fill('History Marker');
  await page.locator('#inspector-name').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(true);
  await expect(page.locator('#workspace-status')).toHaveText('Unsaved changes');
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'marker-tmc-01').name)).toBe('TMC-01');
  await expect(page.locator('#workspace-status')).toHaveText('Saved');
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'marker-tmc-01').name)).toBe('History Marker');
  await expect(page.locator('#workspace-status')).toHaveText('Unsaved changes');
});

test('Delete shortcut is routed to selected rows but not text inputs', async ({ page }) => {
  await boot(page);
  await loadFixture(page);
  const markerRow = page.locator('.workspace-feature-row[data-feature-id="marker-tmc-01"]');
  await markerRow.locator('[data-action="select-feature"]').click();
  await page.locator('#inspector-name').press('End');
  await page.keyboard.press('Delete');
  await expect(page.locator('#inspector-name')).toHaveCount(1);
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === 'marker-tmc-01'))).toBe(true);
  await page.locator('#inspector-name').blur();
  await page.keyboard.press('Delete');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === 'marker-tmc-01'))).toBe(false);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === 'marker-tmc-01'))).toBe(true);
});

test('continuous marker drag commits one domain history entry', async ({ page }) => {
  await boot(page);
  await loadFixture(page);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);
  await page.evaluate(() => {
    const marker = window.__mapToolsTest.getMarkers()[0];
    marker.fire('dragstart');
    marker.setLatLng([13.76, 100.51]).fire('drag');
    marker.setLatLng([13.77, 100.52]).fire('drag');
    marker.setLatLng([13.78, 100.53]).fire('dragend');
  });
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(1);
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.type === 'marker').geometry.coordinates)).toEqual([100.53, 13.78]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.type === 'marker').geometry.coordinates)).toEqual([100.5018, 13.7563]);
});
