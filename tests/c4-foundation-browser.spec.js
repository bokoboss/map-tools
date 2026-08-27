const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const mixedFixture = fs.readFileSync('docs/v2/fixtures/project-v2-mixed.json');

async function boot(page, query = 'test=1') {
  await page.route('**://nominatim.openstreetmap.org/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([])
  }));
  await page.goto(`/index.html?${query}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function loadMixedFixture(page) {
  await page.locator('#file-input').setInputFiles({
    name: 'project-v2-mixed.json',
    mimeType: 'application/json',
    buffer: mixedFixture
  });
  await expect(page.locator('.workspace-feature-row')).toHaveCount(7);
}

function projectIdentity(project) {
  const comparable = JSON.parse(JSON.stringify(project));
  comparable.project.updatedAt = '';
  return JSON.stringify(comparable);
}

test('C4.1A mode switch preserves the canonical project and stable selection', async ({ page }) => {
  await boot(page);
  await loadMixedFixture(page);
  await page.locator('.workspace-feature-row[data-feature-id="polygon-project-boundary"] .workspace-feature-select').click();
  const before = await page.evaluate(() => ({
    project: window.__mapToolsTest.captureProjectDocument(),
    history: window.__mapToolsTest.getHistoryState(),
    dirty: window.__mapToolsTest.isDirty()
  }));
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe('polygon-project-boundary');

  await page.locator('#mode-3d-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('3d-preview');
  await expect(page.locator('.map-renderer-surface[data-renderer-mode="3d-preview"].is-active')).toBeVisible();
  await expect(page.locator('#camera-controls')).toBeVisible();
  expect(await page.evaluate(() => window.__mapToolsTest.getRendererCapabilities())).toMatchObject({
    mode: '3d-preview',
    drawing: false,
    geometryEditing: false,
    featureDragging: false,
    basemapSwitching: false,
    pitchBearing: true,
    contextRequests: true
  });
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe('polygon-project-boundary');

  await page.locator('#toggle-tool-panel-btn').click();
  await expect(page.locator('#draw-polygon-btn')).toBeDisabled();
  await expect(page.locator('#add-pin-btn')).toBeDisabled();
  await page.locator('#mode-2d-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('2d');
  await expect(page.locator('.map-renderer-surface[data-renderer-mode="2d"].is-active')).toBeVisible();
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe('polygon-project-boundary');
  const after = await page.evaluate(() => ({
    project: window.__mapToolsTest.captureProjectDocument(),
    history: window.__mapToolsTest.getHistoryState(),
    dirty: window.__mapToolsTest.isDirty()
  }));
  expect(projectIdentity(after.project)).toBe(projectIdentity(before.project));
  expect(after.history).toEqual(before.history);
  expect(after.dirty).toBe(before.dirty);
});

test('C4.1A camera controls remain transient and reset deterministically', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }));
  await page.locator('#mode-3d-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('3d-preview');

  await page.evaluate(() => window.__mapToolsTest.setCameraPresentation({ pitchDeg: 42, bearingDeg: 137 }));
  await page.locator('#reset-north-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getCameraPresentation())).toMatchObject({ pitchDeg: 42, bearingDeg: 0 });
  await page.locator('#top-view-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getCameraPresentation())).toMatchObject({ pitchDeg: 0, bearingDeg: 0 });

  expect(await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }))).toEqual(before);
  await page.locator('#mode-2d-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('2d');
  expect(await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }))).toEqual(before);
});

test('C4.1A preview failure keeps 2D usable and the project unchanged', async ({ page }) => {
  await boot(page, 'test=1&preview-failure=1');
  const before = await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }));
  await page.locator('#mode-3d-btn').click();
  await expect(page.locator('#renderer-error')).toBeVisible();
  await expect(page.locator('#renderer-error')).toContainText('safe');
  expect(await page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('2d');
  await expect(page.locator('.map-renderer-surface[data-renderer-mode="2d"].is-active')).toBeVisible();
  expect(await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }))).toEqual(before);
});
