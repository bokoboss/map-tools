import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deserializeProject } from '../src/persistence/projectSchema';
import {
  arrowheadSegments,
  geodesicCircleCoordinates,
  haversineDistanceM,
  initialBearingDegrees,
  rectangleToPolygonRing
} from '../src/map/maplibre/geometry';
import { projectToDomFeatures, projectToGeoJson } from '../src/map/maplibre/projectGeoJson';

test('geodesic circles are deterministic, closed, and use canonical longitude/latitude order', () => {
  const center = [100.5018, 13.7563] as const;
  const ring = geodesicCircleCoordinates(center, 1000);
  assert.equal(ring.length, 65);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.deepEqual(center, [100.5018, 13.7563]);
  assert.ok(Math.abs(haversineDistanceM(center, ring[16]) - 1000) < 0.5);
  assert.throws(() => geodesicCircleCoordinates(center, -1), /finite non-negative/);
  assert.deepEqual(geodesicCircleCoordinates(center, 0, 8), Array.from({ length: 9 }, () => center));
});

test('rectangle conversion closes only the renderer polygon ring', () => {
  const bounds = { kind: 'bounds' as const, southWest: [100.5, 13.75] as const, northEast: [100.503, 13.752] as const };
  const ring = rectangleToPolygonRing(bounds);
  assert.deepEqual(ring, [[100.5, 13.75], [100.503, 13.75], [100.503, 13.752], [100.5, 13.752], [100.5, 13.75]]);
  assert.deepEqual(bounds.southWest, [100.5, 13.75]);
});

test('arrow bearing follows the last non-degenerate segment and has a non-degenerate head', () => {
  const coordinates = [[100.5, 13.75], [100.502, 13.751], [100.502, 13.751]] as const;
  const bearing = initialBearingDegrees(coordinates[0], coordinates[1]);
  assert.ok(bearing > 45 && bearing < 70, `unexpected bearing ${bearing}`);
  const head = arrowheadSegments(coordinates);
  assert.equal(head.length, 2);
  assert.ok(haversineDistanceM(head[0][0], head[0][1]) > 0);
  assert.deepEqual(arrowheadSegments([[100.5, 13.75], [100.5, 13.75]]), []);
});

test('mixed ProjectDocumentV2 projects to stable, renderer-only GeoJSON roles', () => {
  const fixture = deserializeProject(require('node:fs').readFileSync('docs/v2/fixtures/project-v2-mixed.json', 'utf8')).document;
  const data = projectToGeoJson(fixture, {
    selectedFeatureId: 'polygon-project-boundary',
    previewExtrusions: { 'polygon-project-boundary': 24, 'circle-study-area': 99 }
  });
  const roles = new Set(data.features.map((feature) => feature.properties.renderRole));
  assert.deepEqual(roles, new Set(['marker', 'radius', 'text', 'line', 'area', 'arrow-shaft', 'arrowhead']));
  const polygon = data.features.find((feature) => feature.properties.featureId === 'polygon-project-boundary' && feature.properties.renderRole === 'area');
  assert.ok(polygon);
  assert.equal(polygon.properties.previewHeightM, 24);
  assert.equal(polygon.properties.selected, true);
  assert.deepEqual(polygon.geometry.type, 'Polygon');
  assert.deepEqual(polygon.geometry.coordinates[0][0], polygon.geometry.coordinates[0].at(-1));
  const circle = data.features.find((feature) => feature.properties.featureId === 'circle-study-area' && feature.properties.renderRole === 'area');
  assert.ok(circle);
  assert.equal(circle.properties.previewHeightM, 0);
  assert.ok(data.features.every((feature) => typeof feature.properties.featureId === 'string'));
  assert.ok(projectToDomFeatures(fixture).some((feature) => feature.featureId === 'text-main-access'));
});
