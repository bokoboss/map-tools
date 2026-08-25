const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../src/project-schema.js');

const mixedFixture = fs.readFileSync(path.join(__dirname, '../docs/v2/fixtures/project-v2-mixed.json'), 'utf8');
const securityFixture = fs.readFileSync(path.join(__dirname, '../docs/v2/fixtures/project-v2-security-text.json'), 'utf8');
const v1Fixture = fs.readFileSync(path.join(__dirname, '../docs/v2/fixtures/project-v1-representative.json'), 'utf8');

test('Project Schema v2 mixed fixture validates and round-trips canonically', () => {
  const first = schema.deserializeProject(mixedFixture).document;
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.features.length, 7);
  assert.deepEqual(first.features.find((feature) => feature.type === 'marker').geometry.coordinates, [100.5018, 13.7563]);
  assert.equal(first.features.find((feature) => feature.type === 'marker').properties.radii.length, 2);
  assert.deepEqual(schema.deserializeProject(schema.serializeProject(first)).document, first);
});

test('all semantic feature discriminators survive serialization', () => {
  const document = schema.deserializeProject(mixedFixture).document;
  assert.deepEqual(document.features.map((feature) => feature.type).sort(), ['arrow', 'circle', 'marker', 'polygon', 'polyline', 'rectangle', 'text']);
});

test('security fixture remains literal project data', () => {
  const document = schema.deserializeProject(securityFixture).document;
  const text = document.features.find((feature) => feature.type === 'text');
  assert.match(text.properties.text, /<script>/i);
  assert.match(text.properties.text, /onload/i);
  assert.equal(schema.serializeProject(document).includes('<script>'), true);
});

test('v1 migration recovers marker, rings, line, and circle without inventing semantics', () => {
  const result = schema.deserializeProject(v1Fixture);
  assert.equal(result.document.schemaVersion, 2);
  assert.deepEqual(result.document.features.map((feature) => feature.type), ['marker', 'polyline', 'circle']);
  assert.deepEqual(result.document.features[0].geometry.coordinates, [100.5018, 13.7563]);
  assert.equal(result.document.features[0].properties.radii.length, 2);
});

test('duplicate IDs, invalid coordinates, and invalid geometry are rejected', () => {
  const base = schema.deserializeProject(mixedFixture).document;
  const duplicate = schema.clone(base);
  duplicate.features[1].id = duplicate.features[0].id;
  assert.throws(() => schema.normalizeProject(duplicate), /duplicate ID/);

  const invalidCoordinate = schema.clone(base);
  invalidCoordinate.features[0].geometry.coordinates = [13.7563, 100.5018];
  assert.throws(() => schema.normalizeProject(invalidCoordinate), /latitude must be between/);

  const invalidGeometry = schema.clone(base);
  invalidGeometry.features.find((feature) => feature.type === 'circle').geometry.radiusM = -1;
  assert.throws(() => schema.normalizeProject(invalidGeometry), /radiusM/);
});

test('unsupported schema versions and malformed JSON fail before a candidate can be used', () => {
  assert.throws(() => schema.deserializeProject('{"schemaVersion":99}'), /Unsupported project schema version/);
  assert.throws(() => schema.deserializeProject('{'), /Invalid project JSON/);
});

test('failed imports leave the active document unchanged', () => {
  const active = schema.deserializeProject(mixedFixture).document;
  const before = schema.serializeProject(active);
  assert.throws(() => schema.deserializeProject('{"schemaVersion":2,"features":[]}'));
  assert.equal(schema.serializeProject(active), before);
});

test('group visibility and locking are derived without overwriting feature state', () => {
  const feature = { visible: true, locked: false };
  const group = { visible: false, locked: true };
  assert.deepEqual(schema.effectiveState(feature, group), { visible: false, locked: true });
  assert.deepEqual(feature, { visible: true, locked: false });
});
