import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './tailwind.css';
import '../style.css';

import { AppController } from './app/AppController';
import { createEmptyProject } from './domain/project';
import { LeafletDrawAdapter } from './drawing/LeafletDrawAdapter';
import { NominatimGeocoder } from './geocoding/NominatimGeocoder';
import { LeafletRenderer } from './map/leaflet/LeafletRenderer';
import { RendererHost } from './map/renderer/RendererHost';
import { deserializeProject, normalizeProject, serializeProject } from './persistence/projectSchema';
import { ProjectStore } from './store/ProjectStore';

const mapElement = document.getElementById('map');
if (!mapElement) throw new Error('Missing #map element');

const store = new ProjectStore(createEmptyProject({ name: 'Untitled Map', appVersion: '2.0.0' }));
let renderer: LeafletRenderer;

const createRenderer = (): LeafletRenderer => new LeafletRenderer(mapElement, {
  onFeatureChanged: (feature) => store.updateFeature(feature),
  onFeatureAction: (action, featureId) => app?.handleRendererAction(action, featureId),
  onMapViewChanged: (view) => {
    const current = store.getSnapshot().mapView;
    if (current.center[0] !== view.center[0] || current.center[1] !== view.center[1] || current.zoom !== view.zoom || current.basemapId !== view.basemapId) store.setMapView(view);
  }
});

renderer = createRenderer();
const rendererHost = new RendererHost(renderer);
const drawing = new LeafletDrawAdapter(renderer);
const app = new AppController(store, rendererHost, drawing, new NominatimGeocoder());

const browserWindow = window as unknown as Window & {
  L: typeof L;
  MapToolsSchema: {
    deserializeProject: typeof deserializeProject;
    normalizeProject: typeof normalizeProject;
    serializeProject: typeof serializeProject;
  };
  startEdit: (runtimeId: number) => void;
  confirmDeleteShapeById: (runtimeId: number) => void;
  openShapeColorEditorById: (runtimeId: number) => void;
  toggleShapeEditById: (runtimeId: number) => void;
  __mapToolsTest?: Record<string, unknown>;
};

browserWindow.L = L;
browserWindow.MapToolsSchema = { deserializeProject, normalizeProject, serializeProject };
browserWindow.startEdit = (runtimeId) => {
  const featureId = renderer.featureIdForRuntimeId(runtimeId);
  if (featureId) app.openMarkerEditor(featureId);
};
browserWindow.confirmDeleteShapeById = (runtimeId) => {
  const featureId = renderer.featureIdForRuntimeId(runtimeId);
  if (featureId) app.requestDelete(featureId);
};
browserWindow.openShapeColorEditorById = (runtimeId) => {
  const featureId = renderer.featureIdForRuntimeId(runtimeId);
  if (featureId) app.openShapeColorEditor(featureId);
};
browserWindow.toggleShapeEditById = (runtimeId) => {
  const featureId = renderer.featureIdForRuntimeId(runtimeId);
  if (featureId) app.toggleShapeEdit(featureId);
};

browserWindow.__mapToolsTest = {
  captureProjectDocument: () => app.captureProjectDocument(),
  getMarkers: () => renderer.getMarkers(),
  getSearchResult: () => renderer.getSearchResult(),
  getDrawnLayers: () => renderer.getDrawnLayers(),
  runtimeSnapshot: () => renderer.runtimeSnapshot(),
  fireMapClick: (lat: number, lon: number) => renderer.fireMapClickForTest(lat, lon),
  addTestShape: (type: string) => app.addTestShape(type as 'polyline' | 'polygon' | 'circle' | 'rectangle' | 'arrow'),
  openTextEditor: (layer: unknown) => {
    const featureId = renderer.featureIdForRuntimeLayer(layer);
    if (featureId) app.openTextEditor(featureId);
  },
  reinitializeRenderer: () => {
    const nextRenderer = rendererHost.replaceWith(createRenderer, store.getSnapshot()) as LeafletRenderer;
    app.setDrawingAdapter(new LeafletDrawAdapter(nextRenderer));
    renderer = nextRenderer;
  }
};
