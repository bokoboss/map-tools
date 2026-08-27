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
  assert.equal(canMutateGroup(project, 'locked-group', 'delete'), false);

  project.groups[0].locked = false;
  feature.locked = true;
  assert.equal(featureIsEffectivelyLocked(project, feature.id), true);
  assert.equal(canMutateGroup(project, 'locked-group', 'rename'), true);
  assert.equal(canMutateGroup(project, 'locked-group', 'delete'), false);
  feature.locked = false;
  assert.equal(featureIsEffectivelyLocked(project, feature.id), false);
  assert.equal(canMutateGroup(project, 'locked-group', 'delete'), true);
});

function groupedProject(projectId: string) {
  const project = createEmptyProject({ projectId });
  const group = { id: 'group-1', name: 'Group', visible: true, locked: false, order: 1 };
  const feature = marker('feature-1');
  feature.groupId = group.id;
  project.groups.push(group);
  project.features.push(feature);
  return { project, groupId: group.id, featureId: feature.id };
}

function tryDeleteGroup(store: ProjectStore, groupId: string): boolean {
  if (!canMutateGroup(store.getSnapshot(), groupId, 'delete')) return false;
  store.mutate((draft) => {
    draft.features.forEach((feature) => {
      if (feature.groupId === groupId) feature.groupId = null;
    });
    draft.groups = draft.groups.filter((group) => group.id !== groupId);
  }, 'Delete group (ungroup children)');
  return true;
}

test('group deletion treats ungrouping as protected group assignment', () => {
  const lockedParent = groupedProject('b4-group-delete-locked-parent');
  lockedParent.project.groups[0].locked = true;
  const lockedParentStore = new ProjectStore(lockedParent.project);
  const lockedParentBefore = lockedParentStore.getSnapshot();
  assert.equal(canMutateGroup(lockedParentBefore, lockedParent.groupId, 'delete'), false);
  assert.equal(tryDeleteGroup(lockedParentStore, lockedParent.groupId), false);
  assert.equal(lockedParentStore.getSnapshot().groups[0].id, lockedParent.groupId);
  assert.equal(lockedParentStore.getSnapshot().features[0].groupId, lockedParent.groupId);
  assert.equal(lockedParentStore.getSnapshot().features[0].locked, false);
  assert.equal(lockedParentStore.getHistoryState().length, 0);
  assert.equal(lockedParentStore.isDirty(), false);

  const lockedChild = groupedProject('b4-group-delete-locked-child');
  lockedChild.project.features[0].locked = true;
  const lockedChildStore = new ProjectStore(lockedChild.project);
  const lockedChildBefore = lockedChildStore.getSnapshot();
  assert.equal(canMutateGroup(lockedChildBefore, lockedChild.groupId, 'delete'), false);
  assert.equal(tryDeleteGroup(lockedChildStore, lockedChild.groupId), false);
  assert.equal(lockedChildStore.getSnapshot().groups[0].id, lockedChild.groupId);
  assert.equal(lockedChildStore.getSnapshot().features[0].groupId, lockedChild.groupId);
  assert.equal(lockedChildStore.getSnapshot().features[0].locked, true);
  assert.equal(lockedChildStore.getHistoryState().length, 0);
  assert.equal(lockedChildStore.isDirty(), false);

  const editable = groupedProject('b4-group-delete-editable');
  const editableStore = new ProjectStore(editable.project);
  assert.equal(canMutateGroup(editableStore.getSnapshot(), editable.groupId, 'delete'), true);
  assert.equal(tryDeleteGroup(editableStore, editable.groupId), true);
  assert.equal(editableStore.getSnapshot().groups.some((group) => group.id === editable.groupId), false);
  assert.equal(editableStore.getSnapshot().features[0].groupId, null);
  assert.equal(editableStore.getSnapshot().features[0].locked, false);
  assert.equal(editableStore.getHistoryState().length, 1);
  assert.equal(editableStore.isDirty(), true);
  assert.equal(editableStore.undo(), true);
  assert.equal(editableStore.getSnapshot().groups[0].id, editable.groupId);
  assert.equal(editableStore.getSnapshot().features[0].groupId, editable.groupId);
  assert.equal(editableStore.getSnapshot().features[0].locked, false);
  assert.equal(editableStore.redo(), true);
  assert.equal(editableStore.getSnapshot().groups.some((group) => group.id === editable.groupId), false);
  assert.equal(editableStore.getSnapshot().features[0].groupId, null);
  assert.equal(editableStore.getSnapshot().features[0].locked, false);
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
    getCapabilities: () => ({ mode: '2d', drawing: true, geometryEditing: true, featureDragging: true, basemapSwitching: true, pitchBearing: false, contextRequests: true }),
    getCameraPresentation: () => ({ pitchDeg: 0, bearingDeg: 0 }),
    setCameraPresentation: () => undefined,
    setView: () => undefined,
    getView: () => view,
    renderProject: () => undefined,
    upsertFeature: () => undefined,
    removeFeature: () => undefined,
    setFeatureVisibility: () => undefined,
    setLabelsVisible: () => undefined,
    setFeatureEditable: () => undefined,
    toggleFeatureEditable: () => undefined,
    setPreviewExtrusions: () => undefined,
    selectFeature: () => undefined,
    fitFeature: () => undefined,
    setBasemap: () => true,
    getBasemapId: () => view.basemapId,
    getBasemapOptions: () => [],
    onMapClick: (listener) => { mapClick.add(listener); return () => mapClick.delete(listener); },
    onMapViewChanged: () => () => undefined,
    onFeatureSelect: (listener) => { featureSelect.add(listener); return () => featureSelect.delete(listener); },
    onContextRequest: (listener) => { context.add(listener); return () => context.delete(listener); },
    cancelActiveInteractions: () => undefined,
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
