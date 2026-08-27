import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type MapMouseEvent
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Coordinate, FeatureId, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';
import type {
  CameraPresentation,
  FeatureAction,
  FeatureChangePhase,
  GeocodingPreview,
  MapContextRequest,
  MapRenderer,
  RendererCapabilities
} from '../renderer/MapRenderer';
import { DEFAULT_BASEMAP_OPTIONS as BASEMAP_OPTIONS } from '../renderer/MapRenderer';
import { OPENFREEMAP_BRIGHT_STYLE } from './previewStyle';

setWorkerUrl(maplibreWorkerUrl);

type MapLibreStyle = NonNullable<ConstructorParameters<typeof MapLibreMap>[0]['style']>;

export interface MapLibrePreviewRendererOptions {
  style?: MapLibreStyle;
  initialView?: MapView;
  forceFailure?: boolean;
  onInitializationError?: (error: unknown) => void;
  onFeatureAction?: (action: FeatureAction, featureId: FeatureId) => void;
  onFeatureChanged?: (feature: ProjectFeature, phase?: FeatureChangePhase) => void;
}

const MAPLIBRE_CAPABILITIES: RendererCapabilities = {
  mode: '3d-preview',
  drawing: false,
  geometryEditing: false,
  featureDragging: false,
  basemapSwitching: false,
  pitchBearing: true,
  contextRequests: true
};

function asCoordinate(event: MapMouseEvent): Coordinate {
  return [event.lngLat.lng, event.lngLat.lat];
}

function asClientPoint(map: MapLibreMap, event: MapMouseEvent): { x: number; y: number } {
  const bounds = map.getContainer().getBoundingClientRect();
  return { x: bounds.left + event.point.x, y: bounds.top + event.point.y };
}

/** The C4.1 foundation renderer. Project overlay layers are added in C4.1B. */
export class MapLibrePreviewRenderer implements MapRenderer {
  readonly map: MapLibreMap;
  private readonly options: MapLibrePreviewRendererOptions;
  private readonly mapClickListeners = new Set<(coordinate: Coordinate) => void>();
  private readonly mapViewListeners = new Set<(view: MapView) => void>();
  private readonly featureSelectListeners = new Set<(featureId: FeatureId | null) => void>();
  private readonly contextRequestListeners = new Set<(request: MapContextRequest) => void>();
  private currentProject: ProjectDocumentV2 | null = null;
  private previewExtrusions: Record<FeatureId, number> = {};
  private currentBasemapId = 'osm-standard';
  private selectedFeatureId: FeatureId | null = null;
  private suppressViewEvent = false;
  private styleReady = false;
  private initializationErrorReported = false;

  constructor(element: HTMLElement, options: MapLibrePreviewRendererOptions = {}) {
    this.options = options;
    if (options.forceFailure) throw new Error('Forced MapLibre initialization failure');
    const view = options.initialView ?? {
      center: [100.5018, 13.7563] as Coordinate,
      zoom: 13,
      basemapId: 'osm-standard'
    };
    try {
      this.map = new MapLibreMap({
        container: element,
        style: options.style ?? OPENFREEMAP_BRIGHT_STYLE,
        center: [view.center[0], view.center[1]],
        zoom: view.zoom,
        pitch: 55,
        bearing: -20,
        attributionControl: {
          compact: true,
          customAttribution: '© OpenFreeMap | © OpenStreetMap contributors'
        },
        canvasContextAttributes: { antialias: true }
      });
    } catch (error) {
      options.onInitializationError?.(error);
      throw error;
    }
    this.map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right');
    this.map.on('load', () => {
      this.styleReady = true;
    });
    this.map.on('error', (event) => {
      if (this.styleReady || this.initializationErrorReported) return;
      this.initializationErrorReported = true;
      options.onInitializationError?.((event as unknown as { error?: unknown }).error ?? new Error('MapLibre style initialization failed'));
    });
    this.map.on('click', (event) => {
      const coordinate = asCoordinate(event);
      this.mapClickListeners.forEach((listener) => listener(coordinate));
    });
    this.map.on('contextmenu', (event) => {
      event.preventDefault();
      this.publishContextRequest(null, event);
    });
    this.map.on('moveend', () => {
      if (this.suppressViewEvent) return;
      const view = this.getView();
      this.mapViewListeners.forEach((listener) => listener(view));
    });
  }

  getCapabilities(): RendererCapabilities { return MAPLIBRE_CAPABILITIES; }

  getCameraPresentation(): CameraPresentation {
    return { pitchDeg: this.map.getPitch(), bearingDeg: this.map.getBearing() };
  }

  setCameraPresentation(presentation: CameraPresentation): void {
    this.map.setPitch(presentation.pitchDeg);
    this.map.setBearing(presentation.bearingDeg);
  }

  setView(view: MapView): void {
    this.currentBasemapId = view.basemapId;
    this.suppressViewEvent = true;
    this.map.jumpTo({ center: [view.center[0], view.center[1]], zoom: view.zoom });
    this.suppressViewEvent = false;
  }

  getView(): MapView {
    const center = this.map.getCenter();
    return { center: [center.lng, center.lat], zoom: this.map.getZoom(), basemapId: this.currentBasemapId };
  }

  renderProject(project: ProjectDocumentV2): void {
    this.currentProject = JSON.parse(JSON.stringify(project)) as ProjectDocumentV2;
    this.setView(project.mapView);
    if (this.selectedFeatureId && !project.features.some((feature) => feature.id === this.selectedFeatureId)) this.selectedFeatureId = null;
  }

  upsertFeature(feature: ProjectFeature): void {
    if (!this.currentProject) return;
    const next = JSON.parse(JSON.stringify(this.currentProject)) as ProjectDocumentV2;
    const index = next.features.findIndex((candidate) => candidate.id === feature.id);
    if (index < 0) next.features.push(JSON.parse(JSON.stringify(feature)) as ProjectFeature);
    else next.features[index] = JSON.parse(JSON.stringify(feature)) as ProjectFeature;
    this.renderProject(next);
  }

  removeFeature(featureId: string): void {
    if (this.currentProject) this.currentProject.features = this.currentProject.features.filter((feature) => feature.id !== featureId);
    if (this.selectedFeatureId === featureId) this.selectFeature(null);
  }

  setFeatureVisibility(_featureId: string, _visible: boolean): void {}
  setLabelsVisible(_visible: boolean): void {}
  setFeatureEditable(_featureId: string, _enabled: boolean): void {}
  toggleFeatureEditable(_featureId: string): void {}
  setPreviewExtrusions(extrusions: Readonly<Record<FeatureId, number>>): void {
    this.previewExtrusions = { ...extrusions };
  }

  selectFeature(featureId: string | null): void {
    this.selectedFeatureId = featureId && this.currentProject?.features.some((feature) => feature.id === featureId) ? featureId : null;
  }

  fitFeature(_featureId: string): void {}

  setBasemap(_basemapId: string): boolean { return false; }
  getBasemapId(): string { return this.currentBasemapId; }
  getBasemapOptions() { return BASEMAP_OPTIONS; }

  onMapClick(listener: (coordinate: Coordinate) => void): () => void {
    this.mapClickListeners.add(listener);
    return () => this.mapClickListeners.delete(listener);
  }

  onMapViewChanged(listener: (view: MapView) => void): () => void {
    this.mapViewListeners.add(listener);
    return () => this.mapViewListeners.delete(listener);
  }

  onFeatureSelect(listener: (featureId: FeatureId | null) => void): () => void {
    this.featureSelectListeners.add(listener);
    return () => this.featureSelectListeners.delete(listener);
  }

  onContextRequest(listener: (request: MapContextRequest) => void): () => void {
    this.contextRequestListeners.add(listener);
    return () => this.contextRequestListeners.delete(listener);
  }

  cancelActiveInteractions(): void {}

  showSearchResult(_preview: GeocodingPreview, _onAdd: () => void): void {}
  clearSearchResult(): void {}

  runtimeSnapshot(): { markers: []; drawn: []; previewExtrusions: Record<FeatureId, number> } {
    return { markers: [], drawn: [], previewExtrusions: { ...this.previewExtrusions } };
  }

  getPreviewFeatureSnapshot(): Array<{ id: FeatureId; type: string; heightM: number | null; visible: boolean; locked: boolean }> {
    return (this.currentProject?.features ?? []).map((feature) => ({
      id: feature.id,
      type: feature.type,
      heightM: this.previewExtrusions[feature.id] ?? null,
      visible: feature.visible,
      locked: feature.locked
    }));
  }

  fireMapClickForTest(lat: number, lon: number): void {
    this.map.fire('click', {
      lngLat: { lat, lng: lon },
      point: { x: 0, y: 0 },
      preventDefault: () => undefined
    } as never);
  }

  destroy(): void {
    this.map.remove();
    this.mapClickListeners.clear();
    this.mapViewListeners.clear();
    this.featureSelectListeners.clear();
    this.contextRequestListeners.clear();
    this.currentProject = null;
  }

  private publishContextRequest(featureId: FeatureId | null, event: MapMouseEvent): void {
    const request: MapContextRequest = {
      featureId,
      coordinate: asCoordinate(event),
      clientPoint: asClientPoint(this.map, event),
      source: 'mouse'
    };
    this.contextRequestListeners.forEach((listener) => listener(request));
  }
}
