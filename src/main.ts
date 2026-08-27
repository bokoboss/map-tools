import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './tailwind.css';
import '../style.css';

import { AppController } from './app/AppController';
import { createEmptyProject } from './domain/project';
import { canMutateFeature } from './domain/mutationPolicy';
import { DisabledDrawingAdapter } from './drawing/DisabledDrawingAdapter';
import { LeafletDrawAdapter } from './drawing/LeafletDrawAdapter';
import { NominatimGeocoder } from './geocoding/NominatimGeocoder';
import { LeafletRenderer } from './map/leaflet/LeafletRenderer';
import { MapLibrePreviewRenderer } from './map/maplibre/MapLibrePreviewRenderer';
import { createDeterministicPreviewStyle, OPENFREEMAP_BRIGHT_STYLE } from './map/maplibre/previewStyle';
import { MapModeController, type RendererBundle } from './map/mode/MapModeController';
import type { MapRenderer, RendererMode } from './map/renderer/MapRenderer';
import { RendererHost } from './map/renderer/RendererHost';
import { deserializeProject, normalizeProject, serializeProject } from './persistence/projectSchema';
import { ProjectStore } from './store/ProjectStore';

const mapElement = document.getElementById('map');
if (!mapElement) throw new Error('Missing #map element');
const mapRoot = mapElement;

const testSurfaceEnabled = new URLSearchParams(window.location.search).has('test');
const searchParams = new URLSearchParams(window.location.search);
const deterministicPreview = testSurfaceEnabled && searchParams.get('preview-provider') !== 'real';
const forcePreviewFailure = testSurfaceEnabled && searchParams.get('preview-failure') === '1';

const rendererSurfaces = new Map<MapRenderer, HTMLElement>();
const latestSurfaceByMode = new Map<RendererMode, HTMLElement>();
let surfaceCounter = 0;

function createRendererSurface(mode: RendererMode): HTMLElement {
  const surface = document.createElement('div');
  surfaceCounter += 1;
  surface.id = `${mode === '2d' ? 'leaflet' : 'maplibre-preview'}-surface-${surfaceCounter}`;
  surface.dataset.rendererMode = mode;
  surface.className = 'map-renderer-surface';
  surface.setAttribute('aria-hidden', 'true');
  mapRoot.appendChild(surface);
  latestSurfaceByMode.set(mode, surface);
  return surface;
}

const setActiveSurface = (mode: RendererMode): void => {
  const current = rendererHost?.getCurrentRenderer();
  const activeSurface = (current && rendererSurfaces.get(current)) ?? latestSurfaceByMode.get(mode);
  mapRoot.querySelectorAll<HTMLElement>('.map-renderer-surface').forEach((surface) => {
    const active = surface === activeSurface;
    surface.classList.toggle('is-active', active);
    surface.setAttribute('aria-hidden', String(!active));
  });
};

const store = new ProjectStore(createEmptyProject({ name: 'Untitled Map', appVersion: '2.0.0' }));

function createLeafletBundle(): RendererBundle {
  const surface = createRendererSurface('2d');
  const renderer = new LeafletRenderer(surface, {
    onFeatureChanged: (feature, phase) => {
      const project = store.getSnapshot();
      const mutationKind = feature.type === 'marker' || feature.type === 'text' ? 'move' : 'geometry';
      if (!canMutateFeature(project, feature.id, mutationKind)) {
        rendererHost?.renderProject(project);
        return;
      }
      store.updateFeature(feature, `${phase === 'update' ? 'Update' : 'Edit'} ${feature.name}`, mutationKind);
      if (phase === 'commit') store.endTransaction();
    },
    onFeatureInteractionStart: (featureId, label) => {
      if (store.getSnapshot().features.some((feature) => feature.id === featureId)) store.beginTransaction(label);
    },
    onFeatureAction: (action, featureId) => app?.handleRendererAction(action, featureId)
  });
  rendererSurfaces.set(renderer, surface);
  return { renderer, drawing: new LeafletDrawAdapter(renderer) };
}

function createPreviewBundle(): RendererBundle {
  const surface = createRendererSurface('3d-preview');
  const renderer = new MapLibrePreviewRenderer(surface, {
    style: deterministicPreview ? createDeterministicPreviewStyle() : OPENFREEMAP_BRIGHT_STYLE,
    initialView: store.getSnapshot().mapView,
    forceFailure: forcePreviewFailure,
    onInitializationError: (error) => modeController?.handlePreviewFailure(error),
    onFeatureAction: (action, featureId) => app?.handleRendererAction(action, featureId)
  });
  rendererSurfaces.set(renderer, surface);
  return { renderer, drawing: new DisabledDrawingAdapter() };
}

const initialBundle = createLeafletBundle();
const rendererHost = new RendererHost(initialBundle.renderer);
setActiveSurface('2d');
const app = new AppController(store, rendererHost, initialBundle.drawing, new NominatimGeocoder());
const modeController = new MapModeController({
  host: rendererHost,
  store,
  create2d: createLeafletBundle,
  create3d: createPreviewBundle,
  prepareForSwitch: () => app.prepareForRendererSwitch(),
  setDrawingAdapter: (drawing) => app.setDrawingAdapter(drawing),
  setActiveSurface,
  onCapabilitiesChanged: (capabilities) => app.updateRendererCapabilities(capabilities),
  onError: (message) => app.showRendererMessage(message)
});
app.setModeController(modeController);

if (testSurfaceEnabled) {
  type BrowserTestSurface = Window & {
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

  const browserWindow = window as unknown as BrowserTestSurface;
  const activeRenderer = (): MapRenderer => rendererHost.getCurrentRenderer();
  const activeLeaflet = (): LeafletRenderer | null => {
    const current = activeRenderer();
    return current instanceof LeafletRenderer ? current : null;
  };
  const activePreview = (): MapLibrePreviewRenderer | null => {
    const current = activeRenderer();
    return current instanceof MapLibrePreviewRenderer ? current : null;
  };

  browserWindow.L = L;
  browserWindow.MapToolsSchema = { deserializeProject, normalizeProject, serializeProject };
  browserWindow.startEdit = (runtimeId) => {
    const renderer = activeLeaflet();
    const featureId = renderer?.featureIdForRuntimeId(runtimeId);
    if (featureId) app.openMarkerEditor(featureId);
  };
  browserWindow.confirmDeleteShapeById = (runtimeId) => {
    const renderer = activeLeaflet();
    const featureId = renderer?.featureIdForRuntimeId(runtimeId);
    if (featureId) app.requestDelete(featureId);
  };
  browserWindow.openShapeColorEditorById = (runtimeId) => {
    const renderer = activeLeaflet();
    const featureId = renderer?.featureIdForRuntimeId(runtimeId);
    if (featureId) app.openShapeColorEditor(featureId);
  };
  browserWindow.toggleShapeEditById = (runtimeId) => {
    const renderer = activeLeaflet();
    const featureId = renderer?.featureIdForRuntimeId(runtimeId);
    if (featureId) app.toggleShapeEdit(featureId);
  };

  browserWindow.__mapToolsTest = {
    captureProjectDocument: () => app.captureProjectDocument(),
    getMarkers: () => activeLeaflet()?.getMarkers() ?? [],
    getSearchResult: () => activeLeaflet()?.getSearchResult() ?? activePreview()?.getSearchResult() ?? null,
    getDrawnLayers: () => activeLeaflet()?.getDrawnLayers() ?? [],
    runtimeSnapshot: () => activeLeaflet()?.runtimeSnapshot() ?? activePreview()?.runtimeSnapshot() ?? { markers: [], drawn: [] },
    getWorkspaceState: () => app.getWorkspaceState(),
    getHistoryState: () => store.getHistoryState(),
    isDirty: () => store.isDirty(),
    undo: () => store.undo(),
    redo: () => store.redo(),
    selectFeature: (featureId: string | null) => app.selectFeature(featureId),
    duplicateFeature: (featureId: string) => app.duplicateFeature(featureId),
    deleteFeature: (featureId: string) => app.deleteFeature(featureId),
    fireMapClick: (lat: number, lon: number) => {
      activeLeaflet()?.fireMapClickForTest(lat, lon);
      activePreview()?.fireMapClickForTest(lat, lon);
    },
    addTestShape: (type: string) => app.addTestShape(type as 'polyline' | 'polygon' | 'circle' | 'rectangle' | 'arrow'),
    openTextEditor: (layer: unknown) => {
      const featureId = activeLeaflet()?.featureIdForRuntimeLayer(layer);
      if (featureId) app.openTextEditor(featureId);
    },
    getRendererMode: () => activeRenderer().getCapabilities().mode,
    getRendererCapabilities: () => activeRenderer().getCapabilities(),
    getMapModeState: () => modeController.getSnapshot(),
    switchMode: (mode: RendererMode) => modeController.switchTo(mode),
    getCameraPresentation: () => activeRenderer().getCameraPresentation(),
    setCameraPresentation: (presentation: { pitchDeg: number; bearingDeg: number }) => {
      activeRenderer().setCameraPresentation(presentation);
      modeController.state.setCameraPresentation(presentation);
    },
    resetNorth: () => modeController.resetNorth(),
    topView: () => modeController.topView(),
    setPreviewExtrusion: (featureId: string, enabled: boolean, heightM?: number) => modeController.setPreviewExtrusion(featureId, enabled, heightM),
    setPreviewHeight: (featureId: string, heightM: number) => modeController.setPreviewHeight(featureId, heightM),
    getPreviewFeatures: () => activePreview()?.getPreviewFeatureSnapshot() ?? [],
    getFeatureScreenPoint: (featureId: string) => activePreview()?.featureScreenPointForTest(featureId) ?? null,
    getPreviewGeoJson: () => activePreview()?.getGeoJsonSnapshot() ?? null,
    getProviderDiagnostics: () => activePreview()?.getProviderDiagnostics() ?? null,
    getFeatureHitIds: (point: { x: number; y: number }) => activePreview()?.featureHitIdsAtScreenPointForTest(point) ?? [],
    getRenderedFeatureDiagnostics: (point: { x: number; y: number }) => activePreview()?.renderedFeatureDiagnosticsForTest(point) ?? [],
    reinitializeRenderer: () => {
      let nextDrawing: RendererBundle['drawing'] | null = null;
      rendererHost.replaceWith(() => {
        const next = createLeafletBundle();
        nextDrawing = next.drawing;
        return next.renderer;
      }, store.getSnapshot());
      if (nextDrawing) app.setDrawingAdapter(nextDrawing);
      setActiveSurface('2d');
    }
  };
}
