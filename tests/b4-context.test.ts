import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canMutateFeature, canMutateGroup, featureIsEffectivelyLocked } from '../src/domain/mutationPolicy';
import { createEmptyProject } from '../src/domain/project';
import type { Coordinate, MapView, ProjectFeature } from '../src/domain/model';
import { NominatimGeocoder } from '../src/geocoding/NominatimGeocoder';
import type { MapContextRequest, MapRenderer } from '../src/map/renderer/MapRenderer';
import { RendererHost } from '../src/map/renderer/RendererHost';
import { ProjectStore } from '../src/store/ProjectStore';

function marker(id = 'marker-1'): Extract<ProjectFeature, { type: 'marker' }> {
  return {
    id,
    type: 'marker',
    name: 'Marker',
    groupId: null,
    visible: true,
    locked: false,
    geometry: { kind: 'point', coordinates: [100.5018, 13.7563] },
    style: { color: '#2563eb', symbolId: 'pin' },
    properties: { radii: [] }
  };
}

test('effective lock policy preserves group and feature lock sources', () => {
  const project = createEmptyProject({ projectId: 'b4-lock-policy' });
  project.groups.push({ id: 'locked-group', name: 'Locked', visible: true, locked: true, order: 1 });
  const feature = marker();
  feature.groupId = 'locked-group';
  project.features.push(feature);

  assert.equal(featureIsEffectivelyLocked(project, feature.id), true);
  assert.equal(canMutateFeature(project, feature.id, 'visibility'), true);
  assert.equal(canMutateFeature(project, feature.id, 'lock'), true);
  for (const kind of ['move', 'geometry', 'name', 'content', 'style', 'radius', 'group', 'delete', 'duplicate', 'property'] as const) {
    assert.equal(canMutateFeature(project, feature.id, kind), false, kind);
  }
  assert.equal(canMutateGroup(project, 'locked-group', 'lock'), true);
  assert.equal(canMutateGroup(project, 'locked-group', 'rename'), false);

  project.groups[0].locked = false;
  feature.locked = true;
  assert.equal(featureIsEffectivelyLocked(project, feature.id), true);
  assert.equal(canMutateGroup(project, 'locked-group', 'rename'), true);
  assert.equal(canMutateGroup(project, 'locked-group', 'delete'), true);
  feature.locked = false;
  assert.equal(featureIsEffectivelyLocked(project, feature.id), false);
  assert.equal(canMutateGroup(project, 'locked-group', 'delete'), true);
});

test('ProjectStore rejects blocked feature mutations without history or dirty state', () => {
  const project = createEmptyProject({ projectId: 'b4-store-lock' });
  const feature = marker('locked-marker');
  feature.locked = true;
  project.features.push(feature);
  const store = new ProjectStore(project);
  const next = { ...feature, name: 'Should remain locked' };

  assert.equal(store.updateFeature(next, 'Blocked rename', 'name'), false);
  assert.equal(store.getSnapshot().features[0].name, 'Marker');
  assert.equal(store.getHistoryState().length, 0);
  assert.equal(store.isDirty(), false);
  assert.equal(store.removeFeature(feature.id), false);
  assert.equal(store.getSnapshot().features.length, 1);

  assert.equal(store.updateFeature({ ...feature, visible: false }, 'Toggle visibility', 'visibility'), true);
  assert.equal(store.getSnapshot().features[0].visible, false);
  assert.equal(store.getHistoryState().length, 1);
  assert.equal(store.isDirty(), true);
});

test('Nominatim reverse geocoding preserves canonical longitude/latitude order', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ lat: '13.7563', lon: '100.5018', display_name: '<literal address>' }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await new NominatimGeocoder('https://example.test').reverse([100.5018, 13.7563]);
    assert.equal(requestedUrl, 'https://example.test/reverse?format=jsonv2&lat=13.7563&lon=100.5018&accept-language=th');
    assert.deepEqual(result, { label: '<literal address>', coordinate: [100.5018, 13.7563] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function fakeRenderer() {
  const mapClick = new Set<(coordinate: Coordinate) => void>();
  const featureSelect = new Set<(featureId: string | null) => void>();
  const context = new Set<(request: MapContextRequest) => void>();
  const view: MapView = { center: [100.5018, 13.7563], zoom: 13, basemapId: 'osm-standard' };
  const renderer: MapRenderer & { emitContext(request: MapContextRequest): void } = {
    setView: () => undefined,
    getView: () => view,
    renderProject: () => undefined,
    upsertFeature: () => undefined,
    removeFeature: () => undefined,
    setFeatureVisibility: () => undefined,
    setLabelsVisible: () => undefined,
    setFeatureEditable: () => undefined,
    toggleFeatureEditable: () => undefined,
    selectFeature: () => undefined,
    fitFeature: () => undefined,
    setBasemap: () => true,
    getBasemapId: () => view.basemapId,
    getBasemapOptions: () => [],
    onMapClick: (listener) => { mapClick.add(listener); return () => mapClick.delete(listener); },
    onFeatureSelect: (listener) => { featureSelect.add(listener); return () => featureSelect.delete(listener); },
    onContextRequest: (listener) => { context.add(listener); return () => context.delete(listener); },
    showSearchResult: () => undefined,
    clearSearchResult: () => undefined,
    destroy: () => undefined,
    emitContext: (request) => context.forEach((listener) => listener(request))
  };
  return renderer;
}

test('RendererHost rebinds a context listener once when the renderer is replaced', () => {
  const first = fakeRenderer();
  const second = fakeRenderer();
  const project = createEmptyProject({ projectId: 'b4-renderer-host' });
  const host = new RendererHost(first);
  let calls = 0;
  host.onContextRequest(() => { calls += 1; });
  const request: MapContextRequest = { featureId: null, coordinate: [100.5, 13.75], clientPoint: { x: 20, y: 30 }, source: 'mouse' };
  first.emitContext(request);
  assert.equal(calls, 1);
  host.replace(second, project);
  first.emitContext(request);
  assert.equal(calls, 1);
  second.emitContext(request);
  assert.equal(calls, 2);
  host.destroy();
  second.emitContext(request);
  assert.equal(calls, 2);
});
