const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const denseFixture = fs.readFileSync('docs/v2/fixtures/project-v2-dense-workspace.json');

async function boot(page) {
  await page.goto('/index.html?test=1', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__mapToolsTest))).toBe(true);
  await page.locator('#file-input').setInputFiles({ name: 'project-v2-dense-workspace.json', mimeType: 'application/json', buffer: denseFixture });
  await expect.poll(() => page.locator('.workspace-feature-row').count()).toBe(40);
}

test('dense workspace UAT is executable primarily through the object panel', async ({ page }) => {
  await boot(page);
  const sourceId = 'marker-survey-01';
  const sourceRow = page.locator(`.workspace-feature-row[data-feature-id="${sourceId}"]`);
  await sourceRow.locator('[data-action="select-feature"]').click();
  await expect(page.locator('#inspector-name')).toHaveValue('Survey Point 01');

  await sourceRow.locator('[data-action="zoom-feature"]').click();
  await expect.poll(() => page.evaluate(() => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === 'marker-survey-01').id)).toBe(sourceId);

  await sourceRow.locator('[data-action="toggle-feature-visibility"]').click();
  expect(await page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).visible, sourceId)).toBe(false);
  await page.locator(`.workspace-feature-row[data-feature-id="${sourceId}"] [data-action="toggle-feature-visibility"]`).click();
  await page.locator(`.workspace-feature-row[data-feature-id="${sourceId}"] [data-action="toggle-feature-lock"]`).click();
  expect(await page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).locked, sourceId)).toBe(true);
  await page.locator(`.workspace-feature-row[data-feature-id="${sourceId}"] [data-action="toggle-feature-lock"]`).click();

  await page.locator('#inspector-name').fill('Survey Point 01 UAT');
  await page.locator('#inspector-name').dispatchEvent('change');
  await page.locator('#inspector-group').selectOption('group-annotations');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).groupId, sourceId)).toBe('group-annotations');

  const originalRadiusIds = await page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).properties.radii.map(radius => radius.id), sourceId);
  await page.locator(`.workspace-feature-row[data-feature-id="${sourceId}"] [data-action="duplicate-feature"]`).click();
  await expect.poll(() => page.locator('.workspace-feature-row').count()).toBe(41);
  const duplicate = await page.evaluate(original => {
    const project = window.__mapToolsTest.captureProjectDocument();
    return project.features.find(feature => feature.id !== original && feature.name === 'Survey Point 01 UAT Copy');
  }, sourceId);
  expect(duplicate).toBeTruthy();
  expect(duplicate.id).not.toBe(sourceId);
  expect(duplicate.properties.radii.map(radius => radius.id)).not.toEqual(originalRadiusIds);
  const duplicateId = duplicate.id;

  await page.locator('#inspector-group').selectOption('group-survey');
  await page.locator('#inspector-marker-color').evaluate(input => {
    input.value = '#dc2626';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.find(feature => feature.id === id).style.color, duplicateId)).toBe('#dc2626');

  const surveyGroup = page.locator('[data-group-id="group-survey"]');
  const sourceFlags = await page.evaluate(id => {
    const feature = window.__mapToolsTest.captureProjectDocument().features.find(item => item.id === id);
    return { visible: feature.visible, locked: feature.locked };
  }, sourceId);
  await surveyGroup.locator('[data-action="toggle-group-visibility"]').click();
  await surveyGroup.locator('[data-action="toggle-group-lock"]').click();
  const unchangedFlags = await page.evaluate(id => {
    const feature = window.__mapToolsTest.captureProjectDocument().features.find(item => item.id === id);
    return { visible: feature.visible, locked: feature.locked };
  }, sourceId);
  expect(unchangedFlags).toEqual(sourceFlags);
  await surveyGroup.locator('[data-action="toggle-group-visibility"]').click();
  await surveyGroup.locator('[data-action="toggle-group-lock"]').click();

  await page.locator(`.workspace-feature-row[data-feature-id="${duplicateId}"] [data-action="delete-feature"]`).click();
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), duplicateId)).toBe(false);
  expect(await page.evaluate(() => window.__mapToolsTest.getWorkspaceState().selectedFeatureId)).toBe(null);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), duplicateId)).toBe(true);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), duplicateId)).toBe(false);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(id => window.__mapToolsTest.captureProjectDocument().features.some(feature => feature.id === id), duplicateId)).toBe(true);
});
