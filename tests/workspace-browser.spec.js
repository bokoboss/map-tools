const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const denseFixture = fs.readFileSync('docs/v2/fixtures/project-v2-dense-workspace.json');

async function boot(page) {
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
}

async function loadDenseFixture(page) {
  await page.locator('#file-input').setInputFiles({ name: 'dense-workspace.json', mimeType: 'application/json', buffer: denseFixture });
  await expect.poll(() => page.locator('.workspace-feature-row').count()).toBe(40);
}

test('dense project is manageable through stable-ID object rows and inspector', async ({ page }) => {
  await boot(page);
  await loadDenseFixture(page);

  const row = page.locator('.workspace-feature-row[data-feature-id="marker-survey-01"]');
  await row.locator('[data-action="select-feature"]').click();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#inspector-name')).toHaveValue('Survey Point 01');

  await page.locator('#inspector-name').fill('Survey Point 01 Renamed');
  await page.locator('#inspector-name').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'marker-survey-01').name)).toBe('Survey Point 01 Renamed');
  await expect(page.locator('#workspace-status')).toHaveText('Unsaved changes');

  const beforeRadii = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'marker-survey-01').properties.radii.map(radius => radius.id));
  await row.locator('[data-action="duplicate-feature"]').click();
  await expect.poll(() => page.locator('.workspace-feature-row').count()).toBe(41);
  const duplicate = page.locator('.workspace-feature-row').filter({ hasText: 'Survey Point 01 Renamed Copy' });
  await expect(duplicate).toHaveCount(1);
  const afterRadii = await duplicate.getAttribute('data-feature-id').then(async id => page.evaluate(featureId => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === featureId).properties.radii.map(radius => radius.id), id));
  expect(afterRadii).toHaveLength(beforeRadii.length);
  expect(afterRadii).not.toEqual(beforeRadii);
});

test('group toggles preserve child flags and delete-by-ungrouping keeps features', async ({ page }) => {
  await boot(page);
  await loadDenseFixture(page);

  const childId = 'marker-survey-01';
  const group = page.locator('[data-group-id="group-survey"]');
  await group.locator('[data-action="toggle-group-visibility"]').click();
  await group.locator('[data-action="toggle-group-lock"]').click();
  const afterToggle = await page.evaluate(featureId => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === featureId), childId);
  expect(afterToggle.visible).toBe(true);
  expect(afterToggle.locked).toBe(false);

  await group.locator('[data-action="delete-group"]').click();
  const afterDelete = await page.evaluate(featureId => {
    const project = window.__mapToolsTest.captureProjectDocument();
    return { groups: project.groups, feature: project.features.find(item => item.id === featureId) };
  }, childId);
  expect(afterDelete.groups.some(groupItem => groupItem.id === 'group-survey')).toBe(false);
  expect(afterDelete.feature).toBeTruthy();
  expect(afterDelete.feature.groupId).toBeNull();
});

test('group deletion is one undoable ungroup mutation', async ({ page }) => {
  await boot(page);
  await loadDenseFixture(page);

  const childIds = await page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features
    .filter(feature => feature.groupId === 'group-survey')
    .map(feature => feature.id));
  expect(childIds.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(0);

  await page.locator('[data-group-id="group-survey"] [data-action="delete-group"]').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getHistoryState().length)).toBe(1);
  const removed = await page.evaluate(ids => {
    const project = window.__mapToolsTest.captureProjectDocument();
    return {
      groupPresent: project.groups.some(group => group.id === 'group-survey'),
      assignments: ids.map(id => project.features.find(feature => feature.id === id).groupId)
    };
  }, childIds);
  expect(removed).toEqual({ groupPresent: false, assignments: childIds.map(() => null) });

  await page.evaluate(() => window.__mapToolsTest.undo());
  const restored = await page.evaluate(ids => {
    const project = window.__mapToolsTest.captureProjectDocument();
    return {
      groupPresent: project.groups.some(group => group.id === 'group-survey'),
      assignments: ids.map(id => project.features.find(feature => feature.id === id).groupId)
    };
  }, childIds);
  expect(restored).toEqual({ groupPresent: true, assignments: childIds.map(() => 'group-survey') });

  await page.evaluate(() => window.__mapToolsTest.redo());
  const redone = await page.evaluate(ids => {
    const project = window.__mapToolsTest.captureProjectDocument();
    return {
      groupPresent: project.groups.some(group => group.id === 'group-survey'),
      assignments: ids.map(id => project.features.find(feature => feature.id === id).groupId)
    };
  }, childIds);
  expect(redone).toEqual({ groupPresent: false, assignments: childIds.map(() => null) });
});

test('renderer reinitialization preserves stable-ID workspace selection', async ({ page }) => {
  await boot(page);
  await loadDenseFixture(page);
  const id = 'text-annotation-03';
  await page.locator(`.workspace-feature-row[data-feature-id="${id}"] [data-action="select-feature"]`).click();
  await page.evaluate(() => window.__mapToolsTest.reinitializeRenderer());
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe(id);
  await expect(page.locator(`.workspace-feature-row[data-feature-id="${id}"]`)).toHaveAttribute('aria-selected', 'true');
});

test('group creation and rename are available from the workspace panel', async ({ page }) => {
  await boot(page);
  await loadDenseFixture(page);
  page.once('dialog', dialog => dialog.accept('Field Notes'));
  await page.locator('#add-group-btn').click();
  await expect(page.locator('.workspace-group').filter({ hasText: 'Field Notes' })).toHaveCount(1);
  const group = page.locator('.workspace-group').filter({ hasText: 'Field Notes' });
  page.once('dialog', dialog => dialog.accept('Field Notes Renamed'));
  await group.locator('[data-action="rename-group"]').click();
  await expect(page.locator('.workspace-group').filter({ hasText: 'Field Notes Renamed' })).toHaveCount(1);
});
