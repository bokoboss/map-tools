import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clone, createEmptyProject } from '../src/domain/project';
import type { ProjectFeature } from '../src/domain/model';
import { ProjectStore } from '../src/store/ProjectStore';
import { WorkspaceState } from '../src/workspace/WorkspaceState';

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

test('create, undo, and redo restore canonical project snapshots', () => {
  const store = new ProjectStore(createEmptyProject({ projectId: 'history-create' }));
  const before = store.getSnapshot();
  store.addFeature(marker());
  const after = store.getSnapshot();
  assert.equal(store.getHistoryState().length, 1);
  assert.equal(store.isDirty(), true);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.getSnapshot().features, before.features);
  assert.equal(store.isDirty(), false);
  assert.equal(store.redo(), true);
  assert.deepEqual(store.getSnapshot().features, after.features);
  assert.equal(store.isDirty(), true);
});

test('saved baseline survives history restoration and undoing to it reports Saved', () => {
  const store = new ProjectStore(createEmptyProject({ projectId: 'history-baseline' }));
  store.addFeature(marker());
  store.markSaved();
  assert.equal(store.isDirty(), false);
  const changed = clone(marker());
  changed.name = 'Changed';
  store.updateFeature(changed);
  assert.equal(store.isDirty(), true);
  assert.equal(store.undo(), true);
  assert.equal(store.getSnapshot().features[0].name, 'Marker');
  assert.equal(store.isDirty(), false);
  assert.equal(store.redo(), true);
  assert.equal(store.isDirty(), true);
});

test('divergent mutation after undo clears redo and loading clears history', () => {
  const store = new ProjectStore(createEmptyProject({ projectId: 'history-divergent' }));
  store.addFeature(marker());
  store.addFeature(marker('marker-2'));
  store.undo();
  assert.equal(store.getHistoryState().canRedo, true);
  store.addFeature(marker('marker-3'));
  assert.equal(store.getHistoryState().canRedo, false);
  store.replaceProject(createEmptyProject({ projectId: 'loaded-project' }));
  assert.deepEqual(store.getHistoryState(), { length: 0, position: 0, canUndo: false, canRedo: false });
  assert.equal(store.isDirty(), false);
});

test('continuous interaction transaction creates one logical history entry', () => {
  const store = new ProjectStore(createEmptyProject({ projectId: 'history-transaction' }));
  store.addFeature(marker());
  store.markSaved();
  store.beginTransaction('Move marker');
  for (const longitude of [100.502, 100.503, 100.504]) {
    const next = clone(store.getSnapshot().features[0]) as Extract<ProjectFeature, { type: 'marker' }>;
    next.geometry.coordinates = [longitude, 13.7563];
    store.updateFeature(next);
  }
  store.endTransaction();
  assert.equal(store.getHistoryState().length, 2);
  assert.deepEqual((store.getSnapshot().features[0].geometry as { coordinates: readonly [number, number] }).coordinates, [100.504, 13.7563]);
  assert.equal(store.undo(), true);
  assert.deepEqual((store.getSnapshot().features[0].geometry as { coordinates: readonly [number, number] }).coordinates, [100.5018, 13.7563]);
});

test('selection and passive map view updates do not create feature-edit history', () => {
  const store = new ProjectStore(createEmptyProject({ projectId: 'history-ui' }));
  const workspace = new WorkspaceState();
  workspace.selectFeature('feature-1');
  workspace.setGroupExpanded('group-1', true);
  store.setMapView({ ...store.getSnapshot().mapView, zoom: 14 });
  assert.equal(store.getHistoryState().length, 0);
  assert.equal(store.isDirty(), true);
});
