const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');

test('A1 baseline exposes marker lifecycle controls and runtime collection', () => {
  for (const id of ['add-pin-btn', 'save-pin-btn', 'delete-pin-btn', 'manage-radius-btn']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(script, /markers = \[\]/);
  assert.match(script, /createMarkerFromData/);
  assert.match(script, /markerToEdit/);
});

test('A1 baseline exposes multiple-radius behavior', () => {
  assert.match(script, /marker\.radii\.forEach/);
  assert.match(script, /radiusToEditId/);
  assert.match(script, /drawCirclesForMarker/);
});

test('A1 baseline exposes all four shape tools and measurement paths', () => {
  for (const id of ['draw-polyline-btn', 'draw-polygon-btn', 'draw-circle-btn', 'draw-rectangle-btn']) assert.match(html, new RegExp(`id="${id}"`));
  for (const token of ['L.Draw.Polyline', 'L.Draw.Polygon', 'L.Draw.Circle', 'L.Draw.Rectangle', 'formatDistance', 'formatArea']) assert.match(script, new RegExp(token.replace('.', '\\.'), 's'));
});

test('A1 baseline exposes arrow and text annotation paths', () => {
  assert.match(html, /id="draw-arrow-btn"/);
  assert.match(html, /id="add-text-btn"/);
  assert.match(script, /isArrow/);
  assert.match(script, /isTextLabel/);
  assert.match(script, /rotation/);
});

test('A1 baseline exposes save/open and deterministic fixture entry points', () => {
  assert.match(html, /id="save-btn"/);
  assert.match(html, /id="open-btn"/);
  assert.match(script, /JSON\.stringify/);
  assert.match(script, /FileReader/);
});

test('A1 baseline search currently uses the provider and marker creation path', () => {
  assert.match(script, /nominatim\.openstreetmap\.org\/search/);
  assert.match(script, /searchResultMarker = createMarkerFromData/);
  assert.match(script, /searchResultMarker/);
});
