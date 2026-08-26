const { test, expect } = require('@playwright/test');

const mockedResults = [
  { lat: '13.7563', lon: '100.5018', display_name: 'Mock Bangkok result' },
  { lat: '13.7000', lon: '100.6000', display_name: 'Mock secondary result' },
  { lat: '13.8000', lon: '100.4000', display_name: 'Mock tertiary result' }
];

async function boot(page) {
  await page.route('**://nominatim.openstreetmap.org/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockedResults)
  }));
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function search(page) {
  await page.locator('#toggle-search-btn').click();
  await page.locator('#search-input').fill('Bangkok');
  await page.locator('#perform-search-btn').click();
  await expect(page.locator('.search-result')).toHaveCount(3);
}

async function waitForSearchNavigation(page) {
  await page.evaluate(() => new Promise(resolve => {
    const marker = window.__mapToolsTest.getSearchResult();
    const map = marker?._map;
    if (!map) return resolve();
    if (map._flyToFrame == null && !map._animating && !map._animatingZoom) return resolve();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      map.off('moveend', finish);
      resolve();
    };
    map.once('moveend', finish);
    setTimeout(finish, 5000);
  }));
}

test('multiple geocoder results are transient until explicit Add to project', async ({ page }) => {
  await boot(page);
  await search(page);
  await waitForSearchNavigation(page);
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(0);
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);
  expect(await page.evaluate(() => window.__mapToolsTest.getSearchResult().getLatLng())).toEqual({ lat: 13.7563, lng: 100.5018 });

  await page.locator('.search-result').nth(1).locator('.search-result-select').click();
  await waitForSearchNavigation(page);
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getSearchResult().getLatLng())).toEqual({ lat: 13.7, lng: 100.6 });
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(0);
  expect(await page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);

  await page.locator('.search-result').nth(1).locator('.search-result-add').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
  expect(await page.evaluate(() => window.__mapToolsTest.getSearchResult() === null)).toBe(true);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(1);
  await page.evaluate(() => window.__mapToolsTest.undo());
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(0);
  await page.evaluate(() => window.__mapToolsTest.redo());
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.length)).toBe(1);
});

test('normal map navigation still persists after a transient search preview', async ({ page }) => {
  await boot(page);
  await search(page);
  await waitForSearchNavigation(page);
  await page.evaluate(() => {
    const map = window.__mapToolsTest.getSearchResult()._map;
    map.setView([13.9, 100.7], 12, { animate: false });
  });
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.isDirty())).toBe(true);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);
  expect(await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().mapView)).toEqual({
    center: [100.7, 13.9],
    zoom: 12,
    basemapId: 'osm-standard'
  });
});
