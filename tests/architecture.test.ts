import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { MapRenderer } from '../src/map/renderer/MapRenderer';
import { RendererHost } from '../src/map/renderer/RendererHost';
import { clone, createEmptyProject } from '../src/domain/project';
import { deserializeProject } from '../src/persistence/projectSchema';

const root = join(process.cwd(), 'src');

test('domain, persistence, and store modules do not import renderer runtimes', () => {
  const files = [
    join(root, 'domain', 'model.ts'),
    join(root, 'domain', 'project.ts'),
    join(root, 'persistence', 'projectSchema.ts'),
    join(root, 'store', 'ProjectStore.ts')
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\bleaflet\b|\bmaplibre\b|\bthree\.js\b/i, file);
    assert.doesNotMatch(source, /\bL\s*\./, file);
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:leaflet|maplibre|three)/i, file);
  }
});

test('renderer-neutral interface contains no Leaflet-only runtime types', () => {
  const source = readFileSync(join(root, 'map', 'renderer', 'MapRenderer.ts'), 'utf8');
  assert.doesNotMatch(source, /\b(?:L\.Layer|L\.LatLng|Leaflet|LatLng|FeatureGroup|pane|stamp)\b/i);
});

test('asymmetric canonical coordinates are converted only at the Leaflet boundary', async () => {
  const module = await import('../src/map/leaflet/coordinates');
  assert.deepEqual(module.toLeafletLatLng([100.5018, 13.7563]), [13.7563, 100.5018]);
  assert.deepEqual(module.fromLeafletLatLng({ lat: 13.7563, lng: 100.5018 } as never), [100.5018, 13.7563]);
});

test('renderer replacement preserves the canonical project snapshot', () => {
  const project = createEmptyProject({ projectId: 'renderer-lifecycle-project' });
  let oldDestroyed = false;
  let renderedProjectId = '';
  const makeRenderer = (isOld: boolean): MapRenderer => ({
    setView: () => undefined,
    getView: () => project.mapView,
    renderProject: (candidate) => { renderedProjectId = candidate.project.id; },
    upsertFeature: () => undefined,
    removeFeature: () => undefined,
    setFeatureVisibility: () => undefined,
    setLabelsVisible: () => undefined,
    setFeatureEditable: () => undefined,
    toggleFeatureEditable: () => undefined,
    selectFeature: () => undefined,
    fitFeature: () => undefined,
    setBasemap: () => true,
    getBasemapId: () => project.mapView.basemapId,
    getBasemapOptions: () => [],
    onMapClick: () => () => undefined,
    showSearchResult: () => undefined,
    clearSearchResult: () => undefined,
    destroy: () => { if (isOld) oldDestroyed = true; }
  });
  const host = new RendererHost(makeRenderer(true));
  host.replace(makeRenderer(false), clone(project));
  assert.equal(oldDestroyed, true);
  assert.equal(renderedProjectId, project.project.id);
  assert.equal(project.features.length, 0);
});

test('TypeScript persistence round-trip remains renderer-independent', () => {
  const fixture = readFileSync(join(process.cwd(), 'docs', 'v2', 'fixtures', 'project-v2-mixed.json'), 'utf8');
  const first = deserializeProject(fixture).document;
  const reopened = deserializeProject(JSON.stringify(first)).document;
  assert.deepEqual(reopened, first);
  assert.deepEqual(reopened.features.find((feature) => feature.type === 'marker')?.geometry.coordinates, [100.5018, 13.7563]);
});

test('Vite entry has no production CDN or Tailwind Play dependency', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com|unpkg\.com\/leaflet|cdnjs\.cloudflare\.com|jsdelivr\.net\/npm/i);
  assert.match(html, /src\/main\.ts/);
});
