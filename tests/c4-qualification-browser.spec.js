const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const mixedFixture = fs.readFileSync('docs/v2/fixtures/project-v2-mixed.json');

async function boot(page, query = 'test=1') {
  await page.route('**://nominatim.openstreetmap.org/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ lat: '13.7563', lon: '100.5018', display_name: 'Mock Bangkok' }])
  }));
  await page.goto(`/index.html?${query}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function loadMixed(page) {
  await page.locator('#file-input').setInputFiles({ name: 'mixed.json', mimeType: 'application/json', buffer: mixedFixture });
  await expect(page.locator('.workspace-feature-row')).toHaveCount(7);
}

async function switch3d(page) {
  await page.locator('#mode-3d-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('3d-preview');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const diagnostics = window.__mapToolsTest.getProviderDiagnostics();
    return diagnostics?.styleReady && (diagnostics.sourceFeatureCount > 0 || window.__mapToolsTest.getPreviewFeatures().length === 0);
  })).toBe(true);
}

async function switch2d(page) {
  await page.locator('#mode-2d-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('2d');
}

async function pointForFeature(page, featureId) {
  const point = await page.evaluate(id => window.__mapToolsTest.getFeatureScreenPoint(id), featureId);
  if (!point) throw new Error(`No MapLibre screen point for ${featureId}`);
  return point;
}

function identity(project) {
  const comparable = JSON.parse(JSON.stringify(project));
  comparable.project.updatedAt = '';
  return JSON.stringify(comparable);
}

test('C4-J1 mixed project round-trips through the real mode buttons with selection intact', async ({ page }) => {
  await boot(page);
  await loadMixed(page);
  await page.locator('.workspace-feature-row[data-feature-id="polygon-project-boundary"] .workspace-feature-select').click();
  const before = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument());
  await switch3d(page);
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe('polygon-project-boundary');
  await switch2d(page);
  expect(identity(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument()))).toBe(identity(before));
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe('polygon-project-boundary');
});

test('C4-J2 pitch, bearing, reset north, and top view stay outside project history', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }));
  await switch3d(page);
  await page.evaluate(() => window.__mapToolsTest.setCameraPresentation({ pitchDeg: 38, bearingDeg: 122 }));
  await page.locator('#reset-north-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getCameraPresentation().bearingDeg)).toBe(0);
  await page.locator('#top-view-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getCameraPresentation().pitchDeg)).toBe(0);
  expect(await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }))).toEqual(before);
});

test('C4-J3 real Bangkok provider exposes OpenFreeMap buildings and attribution', async ({ page }) => {
  test.skip(process.env.C4_REAL_PROVIDER !== '1', 'Live provider smoke is opt-in and must not gate CI.');
  await boot(page, 'test=1&preview-provider=real');
  await loadMixed(page);
  await switch3d(page);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getProviderDiagnostics().styleReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getProviderDiagnostics().buildingFeatureCount)).toBeGreaterThan(0);
  const diagnostics = await page.evaluate(() => window.__mapToolsTest.getProviderDiagnostics());
  expect(diagnostics.buildingSourceUrl).toBe('https://tiles.openfreemap.org/planet');
  expect(diagnostics.buildingLayer).toBe(true);
  expect(diagnostics.attributionText).toContain('OpenFreeMap');
});

test('C4-J4 all semantic feature types and marker radii are identifiable in 3D', async ({ page }) => {
  await boot(page);
  await loadMixed(page);
  await switch3d(page);
  const features = await page.evaluate(() => window.__mapToolsTest.getPreviewFeatures());
  expect(features).toHaveLength(7);
  expect(new Set(features.map(feature => feature.type))).toEqual(new Set(['marker', 'text', 'polyline', 'polygon', 'rectangle', 'circle', 'arrow']));
  await expect(page.locator('.maplibre-project-marker[data-feature-id="marker-tmc-01"]')).toHaveCount(1);
  await expect(page.locator('.maplibre-project-text[data-feature-id="text-main-access"]')).toHaveCount(1);
  const drawn = await page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().drawn);
  expect(drawn.some(feature => feature.id === 'marker-tmc-01' && feature.renderRole === 'radius')).toBe(true);
  for (const id of ['line-study-route', 'polygon-project-boundary', 'rectangle-parking-zone', 'circle-study-area', 'arrow-inbound-flow']) {
    expect(await pointForFeature(page, id)).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  }
});

test('C4-J5 polygon preview extrusion survives mode switches but disappears on reopen', async ({ page }) => {
  await boot(page);
  await loadMixed(page);
  await switch3d(page);
  await page.locator('.workspace-feature-row[data-feature-id="polygon-project-boundary"] .workspace-feature-select').click();
  const before = await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }));
  await page.locator('#preview-extrusion-polygon-project-boundary').check();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getMapModeState().previewExtrusions['polygon-project-boundary'])).toBe(20);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getProviderDiagnostics().projectLayers.includes('map-tools-preview-extrusion'))).toBe(true);
  expect(await page.evaluate(() => window.__mapToolsTest.getPreviewGeoJson().features.find(feature => feature.properties.featureId === 'polygon-project-boundary').properties.previewHeightM)).toBe(20);
  expect(await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }))).toEqual(before);
  await switch2d(page);
  await switch3d(page);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getMapModeState().previewExtrusions['polygon-project-boundary'])).toBe(20);

  const saved = await page.evaluate(() => JSON.stringify(window.__mapToolsTest.captureProjectDocument()));
  await page.locator('#file-input').setInputFiles({ name: 'reopened.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await expect.poll(() => page.evaluate(() => Object.keys(window.__mapToolsTest.getMapModeState().previewExtrusions).length)).toBe(0);
  expect(await page.evaluate(() => window.__mapToolsTest.getPreviewFeatures().find(feature => feature.id === 'polygon-project-boundary').heightM)).toBe(null);
});

test('C4-J6 3D selection/context uses stable IDs, lock policy, and an explicit geometry handoff', async ({ page }) => {
  await boot(page);
  await loadMixed(page);
  await switch3d(page);
  await page.locator('.maplibre-project-marker[data-feature-id="marker-tmc-01"]').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe('marker-tmc-01');

  const polygonPoint = await pointForFeature(page, 'polygon-project-boundary');
  await page.mouse.click(polygonPoint.x, polygonPoint.y, { button: 'right' });
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Project Boundary');
  await menu.getByRole('menuitem', { name: 'Edit geometry' }).click();
  await expect(page.locator('#renderer-error')).toContainText('Switch to 2D to edit geometry.');

  await page.evaluate(() => window.__mapToolsTest.selectFeature('polygon-project-boundary'));
  await page.locator('#inspector-locked').check();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'polygon-project-boundary').locked)).toBe(true);
  await page.mouse.click(polygonPoint.x, polygonPoint.y, { button: 'right' });
  await expect(menu).toContainText('Locked - editing actions are disabled');
  await expect(menu.getByRole('menuitem', { name: 'Edit geometry' })).toBeDisabled();
});

test('C4-J7 canonical property/style edits update 3D overlays and remain undoable after reopen', async ({ page }) => {
  await boot(page);
  await loadMixed(page);
  await switch3d(page);
  await page.locator('.workspace-feature-row[data-feature-id="text-main-access"] .workspace-feature-select').click();
  await page.locator('#inspector-name').fill('Bangkok literal label');
  await page.locator('#inspector-name').press('Tab');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'text-main-access').name)).toBe('Bangkok literal label');
  await expect(page.locator('.maplibre-project-text[data-feature-id="text-main-access"]')).toContainText('Main Access');

  await page.evaluate(() => window.__mapToolsTest.selectFeature('polygon-project-boundary'));
  await page.locator('#inspector-stroke-color').evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, '#ff0000');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getPreviewGeoJson().features.find(feature => feature.properties.featureId === 'polygon-project-boundary' && feature.properties.renderRole === 'area').properties.color)).toBe('#ff0000');
  await page.evaluate(() => window.__mapToolsTest.undo());
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'polygon-project-boundary').style.color)).toBe('#f06eaa');
  await page.evaluate(() => window.__mapToolsTest.redo());
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'polygon-project-boundary').style.color)).toBe('#ff0000');

  const saved = await page.evaluate(() => JSON.stringify(window.__mapToolsTest.captureProjectDocument()));
  await page.locator('#file-input').setInputFiles({ name: 'edited.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'polygon-project-boundary').style.color)).toBe('#ff0000');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'text-main-access').name)).toBe('Bangkok literal label');
});

test('C4-J8 forced 3D failure returns to a usable 2D renderer without mutation', async ({ page }) => {
  await boot(page, 'test=1&preview-failure=1');
  const before = await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }));
  await page.locator('#mode-3d-btn').click();
  await expect(page.locator('#renderer-error')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getRendererMode())).toBe('2d');
  await expect(page.locator('#map .map-renderer-surface[data-renderer-mode="2d"].is-active')).toBeVisible();
  await page.locator('#toggle-tool-panel-btn').click();
  await expect(page.locator('#add-pin-btn')).toBeEnabled();
  expect(await page.evaluate(() => ({ project: window.__mapToolsTest.captureProjectDocument(), history: window.__mapToolsTest.getHistoryState(), dirty: window.__mapToolsTest.isDirty() }))).toEqual(before);
});
