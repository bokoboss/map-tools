const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const mixedFixture = fs.readFileSync('docs/v2/fixtures/project-v2-mixed.json');
const securityFixture = fs.readFileSync('docs/v2/fixtures/project-v2-security-text.json');
const v1Fixture = fs.readFileSync('docs/v2/fixtures/project-v1-representative.json');

const mockedSearchResults = [
  { lat: '13.7563', lon: '100.5018', display_name: 'Mock Bangkok result' },
  { lat: '13.7000', lon: '100.6000', display_name: 'Mock secondary result' },
  { lat: '13.8000', lon: '100.4000', display_name: 'Mock tertiary result' }
];

async function boot(page) {
  await page.route('**://nominatim.openstreetmap.org/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockedSearchResults)
  }));
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function openTools(page) {
  const panel = page.locator('#main-tool-panel');
  if (await panel.evaluate(element => element.classList.contains('hidden'))) await page.locator('#toggle-tool-panel-btn').click();
}

async function addMarker(page, label = 'C-01 marker') {
  await openTools(page);
  await page.locator('#add-pin-btn').click();
  await page.locator('#pin-label-input').fill(label);
  await page.locator('#save-pin-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getMarkers().length)).toBe(1);
}

async function loadFixture(page, name, buffer) {
  await page.locator('#file-input').setInputFiles({ name, mimeType: 'application/json', buffer });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest.captureProjectDocument().features.length))).toBe(true);
}

test('desktop shell renders without page errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await boot(page);
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#toggle-search-btn')).toBeVisible();
  await openTools(page);
  await expect(page.locator('#save-btn')).toBeVisible();
  await expect(page.locator('#open-btn')).toBeVisible();
  await expect(page.locator('#draw-arrow-btn')).toBeVisible();
  await expect(page.locator('#add-text-btn')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('C-01 marker create, drag, edit, and delete behavior', async ({ page }) => {
  await boot(page);
  await addMarker(page);
  await page.evaluate(() => {
    const marker = window.__mapToolsTest.getMarkers()[0];
    marker.setLatLng([13.8, 100.6]);
    marker.fire('drag');
  });
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().markers[0].latlng)).toEqual([13.8, 100.6]);
  await page.evaluate(() => window.startEdit(L.Util.stamp(window.__mapToolsTest.getMarkers()[0])));
  await page.locator('#pin-label-input').fill('C-01 edited marker');
  await page.locator('#save-pin-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().markers[0].label)).toBe('C-01 edited marker');
  await page.evaluate(() => window.startEdit(L.Util.stamp(window.__mapToolsTest.getMarkers()[0])));
  await page.locator('#delete-pin-btn').click();
  await page.locator('#confirm-delete-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getMarkers().length)).toBe(0);
});

test('C-02 multiple radii add, edit, delete, and follow parent drag', async ({ page }) => {
  await boot(page);
  await addMarker(page, 'C-02 radius marker');
  await page.evaluate(() => window.startEdit(L.Util.stamp(window.__mapToolsTest.getMarkers()[0])));
  await page.locator('#manage-radius-btn').click();
  await page.locator('#radius-input').fill('500');
  await page.locator('#add-radius-btn').click();
  await page.locator('#radius-color-selector').click();
  await page.locator('#preset-palette .preset-swatch').nth(0).click();
  await page.locator('#confirm-color-btn').click();
  await page.locator('#radius-input').fill('1000');
  await page.locator('#add-radius-btn').click();
  await expect(page.locator('#radius-list [data-action="delete"]')).toHaveCount(2);
  await page.locator('#radius-list [data-action="edit"]').first().click();
  await page.locator('#radius-input').fill('750');
  await page.locator('#add-radius-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().markers[0].radii.map(radius => radius.distance))).toEqual([750, 1000]);
  const beforeDrag = await page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().markers[0].circles);
  await page.evaluate(() => {
    const marker = window.__mapToolsTest.getMarkers()[0];
    marker.setLatLng([13.81, 100.61]);
    marker.fire('drag');
  });
  const afterDrag = await page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().markers[0]);
  expect(afterDrag.circles.map(circle => circle.radius)).toEqual(beforeDrag.map(circle => circle.radius));
  expect(afterDrag.circles.map(circle => circle.center)).toEqual([[13.81, 100.61], [13.81, 100.61]]);
  await page.locator('#radius-list [data-action="delete"]').first().click();
  await expect(page.locator('#radius-list [data-action="delete"]')).toHaveCount(1);
});

test('C-03 polyline, polygon, rectangle, and circle create/edit/style/delete behavior', async ({ page }) => {
  await boot(page);
  for (const type of ['polyline', 'polygon', 'rectangle', 'circle']) await page.evaluate(shapeType => window.__mapToolsTest.addTestShape(shapeType), type);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.map(feature => feature.type).sort())).toEqual(['circle', 'polygon', 'polyline', 'rectangle']);
  await page.evaluate(() => {
    const layers = window.__mapToolsTest.getDrawnLayers();
    const polyline = layers.find(layer => layer instanceof L.Polyline && !(layer instanceof L.Polygon));
    const polygon = layers.find(layer => layer instanceof L.Polygon && !(layer instanceof L.Rectangle));
    const rectangle = layers.find(layer => layer instanceof L.Rectangle);
    const circle = layers.find(layer => layer instanceof L.Circle);
    polyline.setLatLngs([[13.76, 100.51], [13.762, 100.514]]).setStyle({ color: '#e11d48' }).fire('edit');
    polygon.setLatLngs([[[13.76, 100.51], [13.762, 100.51], [13.762, 100.514]]]).setStyle({ color: '#22c55e' }).fire('edit');
    rectangle.setBounds([[13.76, 100.51], [13.764, 100.516]]).setStyle({ color: '#8b5cf6' }).fire('edit');
    circle.setLatLng([13.76, 100.51]).setRadius(350).setStyle({ color: '#f59e0b' }).fire('edit');
  });
  const edited = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument());
  expect(edited.features.find(feature => feature.type === 'polyline').geometry.coordinates).toEqual([[100.51, 13.76], [100.514, 13.762]]);
  expect(edited.features.find(feature => feature.type === 'circle').geometry.radiusM).toBe(350);
  expect(edited.features.find(feature => feature.type === 'rectangle').style.color).toBe('#8b5cf6');
  while (await page.evaluate(() => window.__mapToolsTest.getDrawnLayers().length)) {
    await page.evaluate(() => window.confirmDeleteShapeById(L.Util.stamp(window.__mapToolsTest.getDrawnLayers()[0])));
    await page.locator('#confirm-delete-btn').click();
  }
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getDrawnLayers().length)).toBe(0);
});

test('C-04 arrow creation/edit keeps arrow head on final segment and deletes', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__mapToolsTest.addTestShape('arrow'));
  let arrow = (await page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().drawn)).find(layer => layer.type === 'arrow');
  expect(arrow.head).toEqual([13.751, 100.502]);
  await page.evaluate(() => {
    const arrow = window.__mapToolsTest.getDrawnLayers().find(layer => layer.isArrow);
    const line = arrow.getLayers().find(layer => layer instanceof L.Polyline);
    line.setLatLngs([[13.75, 100.5], [13.755, 100.515], [13.76, 100.52]]).fire('edit');
  });
  arrow = (await page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().drawn)).find(layer => layer.type === 'arrow');
  expect(arrow.head).toEqual(arrow.line[arrow.line.length - 1]);
  await page.evaluate(() => window.confirmDeleteShapeById(L.Util.stamp(window.__mapToolsTest.getDrawnLayers()[0])));
  await page.locator('#confirm-delete-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getDrawnLayers().length)).toBe(0);
});

test('C-05 text create, drag, edit, rotation, and delete behavior', async ({ page }) => {
  await boot(page);
  await openTools(page);
  await page.locator('#add-text-btn').click();
  await page.evaluate(() => window.__mapToolsTest.fireMapClick(13.75, 100.5));
  await page.locator('#text-label-input').fill('C-05 initial text');
  await page.locator('#save-new-text-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().drawn.find(layer => layer.type === 'text').text)).toBe('C-05 initial text');
  await page.evaluate(() => {
    const text = window.__mapToolsTest.getDrawnLayers().find(layer => layer.isTextLabel);
    text.setLatLng([13.755, 100.505]).fire('drag');
    window.__mapToolsTest.openTextEditor(text);
  });
  await page.locator('#text-label-input').fill('C-05 edited text');
  await page.locator('#save-text-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().drawn.find(layer => layer.type === 'text').text)).toBe('C-05 edited text');
  await page.evaluate(() => window.__mapToolsTest.openTextEditor(window.__mapToolsTest.getDrawnLayers().find(layer => layer.isTextLabel)));
  await page.locator('#rotate-text-btn').click();
  await page.locator('#rotation-slider').fill('30');
  await page.locator('#close-rotate-modal-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.runtimeSnapshot().drawn.find(layer => layer.type === 'text').rotation)).toBe(30);
  await page.locator('#delete-text-btn').click();
  await page.locator('#confirm-delete-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getDrawnLayers().length)).toBe(0);
});

test('C-06 mocked search is deterministic and transient until explicit add', async ({ page }) => {
  await boot(page);
  await page.locator('#toggle-search-btn').click();
  await page.locator('#search-input').fill('Bangkok');
  await page.locator('#perform-search-btn').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest.getSearchResult()))).toBe(true);
  expect(await page.evaluate(() => window.__mapToolsTest.getMarkers().length)).toBe(0);
  await expect(page.locator('.leaflet-popup-content button')).toHaveText('Add to project');
  await page.locator('.leaflet-popup-content button').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getMarkers().length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getSearchResult() === null)).toBe(true);
});

test('C-07 representative v1 project opens, migrates, and saves as v2', async ({ page }) => {
  await boot(page);
  await loadFixture(page, 'project-v1-representative.json', v1Fixture);
  const opened = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument());
  expect(opened.features.map(feature => feature.type)).toEqual(['marker', 'polyline', 'circle']);
  expect(opened.features.find(feature => feature.type === 'marker').properties.radii).toHaveLength(2);
  await openTools(page);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-btn').click();
  const download = await downloadPromise;
  const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(saved.schemaVersion).toBe(2);
  expect(saved.features.map(feature => feature.type)).toEqual(['marker', 'polyline', 'circle']);
});

test('mixed v2 fixture renders all semantic types and marker radius rings', async ({ page }) => {
  await boot(page);
  await loadFixture(page, 'project-v2-mixed.json', mixedFixture);
  const project = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument());
  const runtime = await page.evaluate(() => window.__mapToolsTest.runtimeSnapshot());
  expect(project.features.map(feature => feature.type).sort()).toEqual(['arrow', 'circle', 'marker', 'polygon', 'polyline', 'rectangle', 'text']);
  expect(project.features.find(feature => feature.type === 'marker').properties.radii).toHaveLength(2);
  expect(runtime.markers).toHaveLength(1);
  expect(runtime.markers[0].circles).toHaveLength(2);
  expect(runtime.drawn.map(layer => layer.type).sort()).toEqual(['arrow', 'circle', 'polygon', 'polyline', 'rectangle', 'text']);
  expect(runtime.drawn.find(layer => layer.type === 'arrow').head).toEqual([13.7559, 100.5002]);
});

test('browser save/open round trip preserves marker+radii, text, arrow, rectangle, and circle', async ({ page }) => {
  await boot(page);
  await loadFixture(page, 'project-v2-mixed.json', mixedFixture);
  await openTools(page);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-btn').click();
  const download = await downloadPromise;
  const savedBuffer = fs.readFileSync(await download.path());
  await page.locator('#file-input').setInputFiles({ name: 'round-trip.json', mimeType: 'application/json', buffer: savedBuffer });
  const reopened = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument());
  const feature = type => reopened.features.find(item => item.type === type);
  expect(feature('marker').properties.radii).toHaveLength(2);
  expect(feature('text').properties.text).toContain('Main Access');
  expect(feature('text').style.rotationDeg).toBe(25);
  expect(feature('arrow').geometry.coordinates).toEqual([[100.4982, 13.756], [100.4994, 13.7561], [100.5002, 13.7559]]);
  expect(feature('rectangle').geometry.kind).toBe('bounds');
  expect(feature('circle').geometry.radiusM).toBe(250);
});

test('browser invalid import preserves the active project without partial rendering', async ({ page }) => {
  await boot(page);
  await loadFixture(page, 'project-v2-mixed.json', mixedFixture);
  const before = await page.evaluate(() => {
    const document = window.__mapToolsTest.captureProjectDocument();
    return JSON.stringify({ features: document.features, mapView: document.mapView });
  });
  const dialogPromise = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.message()).toMatch(/invalid|Invalid/);
    await dialog.accept();
  });
  await page.locator('#file-input').setInputFiles({ name: 'malformed.json', mimeType: 'application/json', buffer: Buffer.from('{ malformed') });
  await dialogPromise;
  const after = await page.evaluate(() => {
    const document = window.__mapToolsTest.captureProjectDocument();
    return JSON.stringify({ features: document.features, mapView: document.mapView });
  });
  expect(after).toBe(before);
});

test('security fixture renders project text literally without executing it', async ({ page }) => {
  await boot(page);
  await loadFixture(page, 'project-v2-security-text.json', securityFixture);
  const textLabel = page.locator('.text-label-icon');
  await expect(textLabel).toContainText('<script>window.__MAP_TOOLS_XSS__=true</script>');
  await expect(textLabel.locator('script')).toHaveCount(0);
  await expect(textLabel.locator('[onload]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__MAP_TOOLS_XSS__)).toBeUndefined();
});
