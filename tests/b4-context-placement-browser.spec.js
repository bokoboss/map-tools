const { test, expect } = require('@playwright/test');

async function boot(page, reverseHandler) {
  await page.route('**://nominatim.openstreetmap.org/search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([])
  }));
  if (reverseHandler) await page.route('**://nominatim.openstreetmap.org/reverse**', reverseHandler);
  else await page.route('**://nominatim.openstreetmap.org/reverse**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ lat: '13.7563', lon: '100.5018', display_name: '<literal reverse address>' })
  }));
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function openTools(page) {
  const panel = page.locator('#main-tool-panel');
  if (await panel.evaluate(element => element.classList.contains('hidden'))) await page.locator('#toggle-tool-panel-btn').click();
}

async function rightClickMap(page, x = 260, y = 220) {
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + x, box.y + y, { button: 'right' });
}

async function rightClickFeature(page, featureId) {
  const point = await page.evaluate(id => {
    const layer = window.__mapToolsTest.getDrawnLayers().find(candidate => candidate.projectFeatureId === id);
    if (!layer?._map) throw new Error(`No runtime shape layer for ${id}`);
    const center = layer.getBounds().getCenter();
    const map = layer._map;
    const point = map.latLngToContainerPoint(center);
    const rect = map.getContainer().getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  }, featureId);
  await page.mouse.click(point.x, point.y, { button: 'right' });
}

test('background context menu shows exact coordinates and safe reverse status', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);
  await rightClickMap(page);
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Longitude:');
  await expect(menu).toContainText('Latitude:');
  await expect.poll(() => menu.textContent()).toContain('Address: <literal reverse address>');
  await expect(menu.locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await rightClickMap(page, 420, 300);
  await expect(menu).toBeVisible();
  const longitude = Number((await menu.locator('.context-menu-info').nth(0).textContent()).match(/-?[0-9.]+$/)[0]);
  const latitude = Number((await menu.locator('.context-menu-info').nth(1).textContent()).match(/-?[0-9.]+$/)[0]);
  await menu.getByRole('menuitem', { name: 'Add marker here' }).click();
  await expect(page.locator('#pin-modal')).toBeVisible();
  await page.locator('#pin-label-input').fill('Context marker');
  await page.locator('#save-pin-btn').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
  const created = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0].geometry.coordinates);
  expect(created[0]).toBeCloseTo(longitude, 6);
  expect(created[1]).toBeCloseTo(latitude, 6);
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBeTruthy();
});

test('feature right-click opens only the stable-ID feature menu and syncs workspace', async ({ page }) => {
  await boot(page);
  await openTools(page);
  await page.locator('#add-pin-btn').click();
  await page.locator('#map').click({ position: { x: 260, y: 220 } });
  await page.locator('#pin-label-input').fill('Feature context marker');
  await page.locator('#save-pin-btn').click();
  const markerIcon = page.locator('.leaflet-marker-icon').filter({ has: page.locator('.custom-marker-icon') });
  await markerIcon.click({ button: 'right' });
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Feature context marker');
  await expect(menu.getByRole('menuitem', { name: 'Edit marker' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Add marker here' })).toHaveCount(0);
  await expect(page.locator('.workspace-feature-row[aria-selected="true"]')).toContainText('Feature context marker');
  await expect(page.locator('#inspector')).toContainText('Feature context marker');
});

test('reverse-geocode results cannot update a newer or closed context menu', async ({ page }) => {
  let requestCount = 0;
  let releaseFirst;
  const firstBlocked = new Promise(resolve => { releaseFirst = resolve; });
  await boot(page, async route => {
    requestCount += 1;
    if (requestCount === 1) {
      await firstBlocked;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lat: '13.7563', lon: '100.5018', display_name: 'Stale address' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lat: '13.7564', lon: '100.5019', display_name: 'Current address' }) });
  });
  await rightClickMap(page, 200, 180);
  await expect.poll(() => requestCount).toBe(1);
  await rightClickMap(page, 450, 300);
  await expect.poll(() => page.locator('#context-menu').textContent()).toContain('Address: Current address');
  releaseFirst();
  await page.waitForTimeout(50);
  await expect(page.locator('#context-menu')).toContainText('Address: Current address');
  await rightClickMap(page, 300, 250);
  await expect.poll(() => requestCount).toBe(3);
  await page.keyboard.press('Escape');
  releaseFirst();
  await expect(page.locator('#context-menu')).toBeHidden();
});

test('toolbar Add Pin uses exact placement mode and cancel paths create nothing', async ({ page }) => {
  await boot(page);
  await openTools(page);
  await page.locator('#add-pin-btn').click();
  await expect(page.locator('#placement-status')).toBeVisible();
  await expect(page.locator('#pin-modal')).toBeHidden();
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(0);
  await page.locator('#map').click({ position: { x: 260, y: 220 } });
  await expect(page.locator('#pin-modal')).toBeVisible();
  const locationText = await page.locator('#pin-coordinate-preview').textContent();
  const values = locationText.match(/-?[0-9.]+/g).map(Number);
  await page.locator('#pin-label-input').fill('Placed marker');
  await page.locator('#save-pin-btn').click();
  const savedCoordinate = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features[0].geometry.coordinates);
  expect(savedCoordinate[0]).toBeCloseTo(values[0], 6);
  expect(savedCoordinate[1]).toBeCloseTo(values[1], 6);

  await page.locator('#add-pin-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#placement-status')).toBeHidden();
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);

  await page.locator('#add-pin-btn').click();
  await page.locator('#map').click({ position: { x: 330, y: 260 } });
  await expect(page.locator('#pin-modal')).toBeVisible();
  await page.locator('#cancel-pin-btn').click();
  await expect(page.locator('#pin-modal')).toBeHidden();
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
});

test('activating another annotation tool cancels marker placement', async ({ page }) => {
  await boot(page);
  await openTools(page);
  await page.locator('#add-pin-btn').click();
  await expect(page.locator('#placement-status')).toBeVisible();
  await page.locator('#draw-polyline-btn').click();
  await expect(page.locator('#placement-status')).toBeHidden();
  await expect(page.locator('#add-pin-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(0);
});

test('polyline, rectangle, and circle expose generic feature context actions', async ({ page }) => {
  await boot(page);
  for (const type of ['polyline', 'rectangle', 'circle']) {
    await page.evaluate(shapeType => window.__mapToolsTest.addTestShape(shapeType), type);
    const feature = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.at(-1));
    await rightClickFeature(page, feature.id);
    const menu = page.locator('#context-menu');
    await expect(menu.getByRole('menuitem', { name: 'Edit geometry' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Edit style/color' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Delete object' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Add marker here' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});
