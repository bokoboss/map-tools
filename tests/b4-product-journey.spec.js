const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const denseFixture = fs.readFileSync('docs/v2/fixtures/project-v2-dense-workspace.json');

async function boot(page, reverseBody = { lat: '13.7563', lon: '100.5018', display_name: 'Mock reverse address' }) {
  await page.route('**://nominatim.openstreetmap.org/search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([])
  }));
  await page.route('**://nominatim.openstreetmap.org/reverse**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(reverseBody)
  }));
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function openTools(page) {
  const panel = page.locator('#main-tool-panel');
  if (await panel.evaluate(element => element.classList.contains('hidden'))) await page.locator('#toggle-tool-panel-btn').click();
}

async function loadDenseFixture(page) {
  await page.locator('#file-input').setInputFiles({ name: 'dense-workspace.json', mimeType: 'application/json', buffer: denseFixture });
  await expect.poll(() => page.locator('.workspace-feature-row').count()).toBe(40);
}

async function rightClickMap(page, x = 720, y = 420) {
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + x, box.y + y, { button: 'right' });
}

async function screenPointForFeature(page, featureId) {
  return page.evaluate(id => {
    const surface = window.__mapToolsTest;
    const candidates = [...surface.getMarkers(), ...surface.getDrawnLayers()];
    const layer = candidates.find(candidate => candidate.projectFeatureId === id);
    if (!layer) throw new Error(`No runtime layer for ${id}`);
    const map = layer._map || layer.getLayers?.()[0]?._map;
    if (!map) throw new Error(`No map for ${id}`);
    const element = layer.getElement?.();
    if (element) {
      const elementRect = element.getBoundingClientRect();
      return { x: elementRect.left + elementRect.width / 2, y: elementRect.top + elementRect.height / 2 };
    }
    const center = layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter();
    const point = map.latLngToContainerPoint(center);
    const rect = map.getContainer().getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  }, featureId);
}

async function rightClickFeature(page, featureId) {
  const point = await screenPointForFeature(page, featureId);
  await page.mouse.click(point.x, point.y, { button: 'right' });
}

async function chooseColor(page, selectorId, color) {
  await page.locator(`#${selectorId}`).click();
  await page.locator('#hex-input').fill(color);
  await page.locator('#hex-input').dispatchEvent('change');
  await page.locator('#confirm-color-btn').click();
}

async function saveAndReopen(page) {
  await openTools(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save-btn').click()
  ]);
  const savedPath = await download.path();
  if (!savedPath) throw new Error('The project download did not produce a path');
  await page.locator('#file-input').setInputFiles(savedPath);
}

async function createToolbarMarker(page, label = 'Journey marker') {
  await openTools(page);
  await page.locator('#add-pin-btn').click();
  await page.locator('#map').click({ position: { x: 450, y: 420 } });
  await expect(page.locator('#pin-modal')).toBeVisible();
  await page.locator('#pin-label-input').fill(label);
  await page.locator('#save-pin-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
  return page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0]);
}

async function drawPolygonWithToolbar(page) {
  await openTools(page);
  await page.locator('#draw-polygon-btn').click();
  const box = await page.locator('#map').boundingBox();
  const points = [{ x: 450, y: 180 }, { x: 540, y: 240 }, { x: 450, y: 320 }];
  for (const point of points) {
    await page.mouse.click(box.x + point.x, box.y + point.y);
    await page.waitForTimeout(75);
  }
  await page.waitForTimeout(100);
  await expect(page.locator('.leaflet-marker-icon.leaflet-editing-icon')).toHaveCount(3);
  await page.locator('.leaflet-marker-icon.leaflet-editing-icon').first().dispatchEvent('click');
  await page.waitForTimeout(100);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
  return page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0]);
}

async function drawArrowWithToolbar(page) {
  await openTools(page);
  await page.locator('#draw-arrow-btn').click();
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + 760, box.y + 180);
  await page.waitForTimeout(75);
  await page.mouse.click(box.x + 830, box.y + 260);
  await page.waitForTimeout(100);
  await expect(page.locator('.leaflet-marker-icon.leaflet-editing-icon')).toHaveCount(2);
  await page.locator('.leaflet-marker-icon.leaflet-editing-icon').last().click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(2);
  return page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.type === 'arrow'));
}

test('J1 exact-point context marker survives radius, drag, undo/redo, save, and reopen', async ({ page }) => {
  await boot(page, { lat: '13.7563', lon: '100.5018', display_name: '<safe literal address>' });
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);

  await rightClickMap(page, 720, 420);
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.textContent()).toContain('Address: <safe literal address>');
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);
  const longitude = Number((await menu.locator('.context-menu-info').nth(0).textContent()).match(/-?[0-9.]+$/)[0]);
  const latitude = Number((await menu.locator('.context-menu-info').nth(1).textContent()).match(/-?[0-9.]+$/)[0]);

  await menu.getByRole('menuitem', { name: 'Add marker here' }).click();
  await expect(page.locator('#pin-modal')).toBeVisible();
  await expect(page.locator('#pin-coordinate-preview')).toContainText('Location:');
  await page.locator('#pin-label-input').fill('J1 context marker');
  await chooseColor(page, 'marker-color-selector', '#dc2626');
  await page.locator('#save-pin-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
  const created = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0]);
  expect(created.geometry.coordinates[0]).toBeCloseTo(longitude, 6);
  expect(created.geometry.coordinates[1]).toBeCloseTo(latitude, 6);
  expect(created.style.color).toBe('#dc2626');
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe(created.id);

  await page.locator('#inspector-radius-distance').fill('250');
  await page.locator('[data-action="add-radius"]').click();
  await expect(page.locator('[data-action="delete-radius"]')).toHaveCount(1);
  const beforeDrag = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0]);
  const historyBeforeDrag = await page.evaluate(() => window.__mapToolsTest.getHistoryState().length);
  const point = await screenPointForFeature(page, created.id);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 50, point.y + 30);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).geometry.coordinates, created.id)).not.toEqual(beforeDrag.geometry.coordinates);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(historyBeforeDrag + 1);
  const moved = await page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id), created.id);
  expect(moved.properties.radii).toHaveLength(1);

  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id), created.id)).toMatchObject({ geometry: beforeDrag.geometry });
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).properties.radii, created.id)).toHaveLength(1);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).geometry.coordinates, created.id)).toEqual(moved.geometry.coordinates);

  await saveAndReopen(page);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
  const reopened = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0]);
  expect(reopened).toMatchObject({ id: created.id, name: 'J1 context marker', style: { color: '#dc2626' }, geometry: moved.geometry });
  expect(reopened.properties.radii).toEqual(moved.properties.radii);
});

test('J3 marker context actions converge on edit, radius, delete, and undo', async ({ page }) => {
  await boot(page);
  const marker = await createToolbarMarker(page, 'J3 marker');
  await page.locator('#inspector-name').fill('J3 marker with radius');
  await page.locator('#inspector-name').dispatchEvent('change');
  await page.locator('#inspector-radius-distance').fill('400');
  await page.locator('[data-action="add-radius"]').click();

  await rightClickFeature(page, marker.id);
  const menu = page.locator('#context-menu');
  await expect(menu.getByRole('menuitem', { name: 'Edit marker' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Manage radii' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete marker' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Edit marker' }).click();
  await page.locator('#pin-label-input').fill('J3 edited marker');
  await page.locator('#save-pin-btn').click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).name, marker.id)).toBe('J3 edited marker');

  await rightClickFeature(page, marker.id);
  await page.locator('#context-menu').getByRole('menuitem', { name: 'Manage radii' }).click();
  await expect(page.locator('#radius-list [data-action="delete"]')).toHaveCount(1);
  await page.locator('#radius-list [data-action="delete"]').click();
  await expect(page.locator('#radius-list [data-action="delete"]')).toHaveCount(0);
  await page.locator('#close-radius-modal-btn').click();

  await rightClickFeature(page, marker.id);
  await page.locator('#context-menu').getByRole('menuitem', { name: 'Delete marker' }).click();
  await expect(page.locator('#delete-confirm-modal')).toBeVisible();
  await page.locator('#confirm-delete-btn').click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), marker.id)).toBe(false);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), marker.id)).toBe(true);
  const restored = await page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id), marker.id);
  expect(restored.name).toBe('J3 edited marker');
  expect(restored.properties.radii).toHaveLength(0);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), marker.id)).toBe(false);
});

test('J4 text context edit and rotate preserve literal text through undo/redo and delete', async ({ page }) => {
  await boot(page);
  await openTools(page);
  await page.locator('#add-text-btn').click();
  await page.locator('#map').click({ position: { x: 650, y: 420 } });
  await page.locator('#text-label-input').fill('<img src=x onerror=alert(1)> literal');
  await page.locator('#save-new-text-btn').click();
  const text = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0]);
  expect(text.properties.text).toBe('<img src=x onerror=alert(1)> literal');

  await rightClickFeature(page, text.id);
  const menu = page.locator('#context-menu');
  await expect(menu.getByRole('menuitem', { name: 'Edit text' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Rotate text' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete text' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Edit text' }).click();
  await page.locator('#text-label-input').fill('<b>edited literal</b>');
  await page.locator('#save-text-btn').click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).properties.text, text.id)).toBe('<b>edited literal</b>');

  await rightClickFeature(page, text.id);
  await page.locator('#context-menu').getByRole('menuitem', { name: 'Rotate text' }).click();
  await page.locator('#rotation-slider').fill('45');
  await page.locator('#rotation-slider').dispatchEvent('input');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.rotationDeg, text.id)).toBe(45);
  await page.locator('#close-rotate-modal-btn').click();

  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.rotationDeg, text.id)).toBe(0);
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).properties.text, text.id)).toBe('<b>edited literal</b>');
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.rotationDeg, text.id)).toBe(45);

  await rightClickFeature(page, text.id);
  await page.locator('#context-menu').getByRole('menuitem', { name: 'Delete text' }).click();
  await page.locator('#confirm-delete-btn').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).properties.text, text.id)).toBe('<b>edited literal</b>');
  expect(await page.evaluate(() => document.querySelectorAll('.text-label-icon img, .text-label-icon script').length)).toBe(0);
});

test('J5 polygon and arrow use context style/geometry routes and survive undo/redo/save/open', async ({ page }) => {
  await boot(page);
  const polygon = await drawPolygonWithToolbar(page);
  await rightClickFeature(page, polygon.id);
  const polygonMenu = page.locator('#context-menu');
  await expect(polygonMenu.getByRole('menuitem', { name: 'Edit geometry' })).toBeVisible();
  await expect(polygonMenu.getByRole('menuitem', { name: 'Edit style/color' })).toBeVisible();
  await expect(polygonMenu.getByRole('menuitem', { name: 'Delete object' })).toBeVisible();
  await polygonMenu.getByRole('menuitem', { name: 'Edit style/color' }).click();
  await chooseColor(page, 'shape-color-selector', '#7c3aed');
  await page.locator('#close-shape-edit-btn').click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, polygon.id)).toBe('#7c3aed');
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, polygon.id)).toBe('#f06eaa');
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, polygon.id)).toBe('#7c3aed');

  await rightClickFeature(page, polygon.id);
  await page.locator('#context-menu').getByRole('menuitem', { name: 'Edit geometry' }).click();
  const polygonGeometry = await page.evaluate(id => {
    const layer = window.__mapToolsTest.getDrawnLayers().find(candidate => candidate.projectFeatureId === id);
    const coordinates = layer.getLatLngs()[0];
    coordinates[0].lat += 0.0004;
    layer.setLatLngs([coordinates]);
    layer.fire('editstart');
    layer.fire('edit');
    layer.fire('editend');
    return window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).geometry;
  }, polygon.id);
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).geometry, polygon.id)).toEqual(polygonGeometry);

  const arrow = await drawArrowWithToolbar(page);
  await rightClickFeature(page, arrow.id);
  const arrowMenu = page.locator('#context-menu');
  await expect(arrowMenu.getByRole('menuitem', { name: 'Edit geometry' })).toBeVisible();
  await arrowMenu.getByRole('menuitem', { name: 'Edit style/color' }).click();
  await chooseColor(page, 'shape-color-selector', '#059669');
  await page.locator('#close-shape-edit-btn').click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, arrow.id)).toBe('#059669');
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, arrow.id)).toBe('#10b981');
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, arrow.id)).toBe('#059669');

  await saveAndReopen(page);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.filter(feature => feature.type === 'polygon' || feature.type === 'arrow').length)).toBe(2);
  const reopened = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.filter(feature => feature.type === 'polygon' || feature.type === 'arrow'));
  expect(reopened.find(feature => feature.id === polygon.id).type).toBe('polygon');
  expect(reopened.find(feature => feature.id === arrow.id)).toMatchObject({ id: arrow.id, type: 'arrow', style: { arrowHead: 'end', color: '#059669' } });
});

test('J6 direct and group locks protect every prohibited route while preserving legitimate unlocks', async ({ page }) => {
  await boot(page);
  await loadDenseFixture(page);
  const directId = 'marker-survey-01';
  const directRow = page.locator(`.workspace-feature-row[data-feature-id="${directId}"]`);
  await directRow.locator('[data-action="select-feature"]').click();
  await directRow.locator('[data-action="toggle-feature-lock"]').click();
  await expect(directRow).toHaveClass(/is-locked-feature/);
  await expect(page.locator('#inspector-name')).toBeDisabled();
  await expect(page.locator('#inspector-group')).toBeDisabled();
  await expect(page.locator('#inspector-marker-color')).toBeDisabled();
  await expect(page.locator('#inspector-radius-distance')).toBeDisabled();
  await expect(page.locator('[data-action="add-radius"]')).toBeDisabled();
  await expect(page.locator('[data-action="delete-radius"]')).toHaveCount(1);
  await expect(page.locator('[data-action="delete-radius"]')).toBeDisabled();
  await expect(page.locator('#inspector-visible')).toBeEnabled();
  await expect(page.locator('#inspector-locked')).toBeEnabled();
  await expect(directRow.locator('[data-action="duplicate-feature"]')).toBeDisabled();
  await expect(directRow.locator('[data-action="delete-feature"]')).toBeDisabled();
  await expect(directRow.locator('[data-action="zoom-feature"]')).toBeEnabled();
  const beforeBlocked = await page.evaluate(id => ({
    project: window.__mapToolsTest.captureProjectDocument(),
    history: window.__mapToolsTest.getHistoryState().length,
    dirty: window.__mapToolsTest.isDirty()
  }), directId);

  await rightClickFeature(page, directId);
  const menu = page.locator('#context-menu');
  for (const name of ['Edit marker', 'Manage radii', 'Delete marker']) await expect(menu.getByRole('menuitem', { name })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Delete');
  await page.evaluate(id => {
    const input = document.querySelector('#inspector-name');
    input.value = 'Blocked inspector edit';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const marker = window.__mapToolsTest.getMarkers().find(candidate => candidate.projectFeatureId === id);
    marker.setLatLng([13.8, 100.6]);
    marker.fire('dragstart');
    marker.fire('drag');
    marker.fire('dragend');
  }, directId);
  await expect.poll(() => page.evaluate(id => {
    const feature = window.__mapToolsTest.captureProjectDocument().features.find(candidate => candidate.id === id);
    return { name: feature.name, coordinates: feature.geometry.coordinates, history: window.__mapToolsTest.getHistoryState().length, dirty: window.__mapToolsTest.isDirty() };
  }, directId)).toEqual({ name: beforeBlocked.project.features.find(feature => feature.id === directId).name, coordinates: beforeBlocked.project.features.find(feature => feature.id === directId).geometry.coordinates, history: beforeBlocked.history, dirty: beforeBlocked.dirty });

  const popupPoint = await screenPointForFeature(page, directId);
  await page.mouse.click(popupPoint.x, popupPoint.y);
  await expect(page.locator('.leaflet-popup .popup-actions button')).toHaveCount(3);
  expect(await page.locator('.leaflet-popup .popup-actions button').evaluateAll(buttons => buttons.every(button => button.disabled))).toBe(true);
  await page.keyboard.press('Escape');
  await directRow.locator('[data-action="select-feature"]').click();

  await directRow.locator('[data-action="toggle-feature-visibility"]').click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).visible, directId)).toBe(false);
  await directRow.locator('[data-action="toggle-feature-lock"]').click();
  await expect(page.locator('#inspector-name')).toBeEnabled();

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
  await loadDenseFixture(page);
  const group = page.locator('[data-group-id="group-survey"]');
  const child = page.locator(`.workspace-feature-row[data-feature-id="${directId}"]`);
  await group.locator('[data-action="toggle-group-lock"]').click();
  await expect(child).toHaveClass(/is-locked-feature/);
  await child.locator('[data-action="select-feature"]').click();
  await expect(page.locator('#inspector-name')).toBeDisabled();
  await expect(group.locator('[data-action="rename-group"]')).toBeDisabled();
  await expect(group.locator('[data-action="delete-group"]')).toBeEnabled();
  await child.locator('[data-action="toggle-feature-lock"]').click();
  expect(await page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).locked, directId)).toBe(true);
  await group.locator('[data-action="toggle-group-lock"]').click();
  await expect(child).toHaveClass(/is-locked-feature/);
  await expect(page.locator('#inspector-name')).toBeDisabled();
  await child.locator('[data-action="toggle-feature-lock"]').click();
  await expect(child).not.toHaveClass(/is-locked-feature/);
  await expect(page.locator('#inspector-name')).toBeEnabled();
});

test('J7 context menu lifecycle, viewport clamping, focus, and Escape are deterministic', async ({ page }) => {
  await boot(page);
  await rightClickMap(page, 880, 780);
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Add marker here' })).toBeFocused();
  const menuBox = await menu.boundingBox();
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(1280);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(800);
  await rightClickMap(page, 500, 300);
  await expect(menu).toBeVisible();
  await page.locator('#map').click({ position: { x: 500, y: 300 } });
  await expect(menu).toBeHidden();
  await rightClickMap(page, 500, 300);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.locator('#toggle-info-btn').click();
  await expect(page.locator('#info-modal')).toBeVisible();
});

test('J8 Help describes the current controls and the touch-equivalent workflow', async ({ page }) => {
  await boot(page);
  await page.locator('#toggle-info-btn').click();
  const help = page.locator('#help-current-workflow');
  await expect(help).toBeVisible();
  for (const phrase of [
    'Pan',
    'zoom',
    'Layers',
    'Search',
    'Add Pin',
    'right-click',
    'Objects / Inspector',
    'Undo',
    'Redo',
    'Saved',
    'Unsaved changes',
    'locked',
    'Touch',
    'Open',
    'Save',
    'Export'
  ]) await expect(help).toContainText(phrase);
  await expect(page.locator('#add-pin-btn')).toHaveAttribute('aria-label', /Add pin/);
  await expect(page.locator('#open-btn')).toBeAttached();
  await expect(page.locator('#save-btn')).toBeAttached();
  await expect(page.locator('#export-image-btn')).toBeAttached();
});
