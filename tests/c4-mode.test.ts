import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_3D_CAMERA, MapModeState } from '../src/map/mode/MapModeState';

test('3D camera and preview extrusion state are transient and isolated from canonical data', () => {
  const state = new MapModeState();
  assert.deepEqual(state.getSnapshot(), { mode: '2d', camera3d: DEFAULT_3D_CAMERA, previewExtrusions: {} });

  state.setMode('3d-preview');
  state.setCameraPresentation({ pitchDeg: 90, bearingDeg: 122 });
  state.setPreviewExtrusion('polygon-1', 20);
  const snapshot = state.getSnapshot();
  assert.deepEqual(snapshot.camera3d, { pitchDeg: 60, bearingDeg: 122 });
  assert.deepEqual(snapshot.previewExtrusions, { 'polygon-1': 20 });

  snapshot.previewExtrusions['polygon-1'] = 999;
  assert.equal(state.getSnapshot().previewExtrusions['polygon-1'], 20);
  state.clearPreviewExtrusions();
  assert.deepEqual(state.getSnapshot().previewExtrusions, {});
});
