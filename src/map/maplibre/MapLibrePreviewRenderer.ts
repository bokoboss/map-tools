import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type MapMouseEvent
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { clone, effectiveState } from '../../domain/project';
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
import { OPENFREEMAP_BRIGHT_STYLE, OPENFREEMAP_PLANET_SOURCE } from './previewStyle';
import { projectToDomFeatures, projectToGeoJson, type ProjectGeoJson, type ProjectGeoJsonFeature } from './projectGeoJson';

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

export const MAPLIBRE_CAPABILITIES: RendererCapabilities = {
  mode: '3d-preview',
  drawing: false,
  geometryEditing: false,
  featureDragging: false,
  basemapSwitching: false,
  pitchBearing: true,
  contextRequests: true
};

const PROJECT_SOURCE_ID = 'map-tools-project-features';
const BUILDING_SOURCE_ID = 'openfreemap-planet';
const BUILDING_LAYER_ID = 'map-tools-openfreemap-buildings-3d';
const RADIUS_FILL_LAYER_ID = 'map-tools-radius-fill';
const RADIUS_LINE_LAYER_ID = 'map-tools-radius-line';
const AREA_FILL_LAYER_ID = 'map-tools-area-fill';
const AREA_LINE_LAYER_ID = 'map-tools-area-line';
const EXTRUSION_LAYER_ID = 'map-tools-preview-extrusion';
const PROJECT_LINE_LAYER_ID = 'map-tools-project-line';
const PROJECT_INTERACTIVE_LAYER_IDS = [
  RADIUS_FILL_LAYER_ID,
  RADIUS_LINE_LAYER_ID,
  AREA_FILL_LAYER_ID,
  AREA_LINE_LAYER_ID,
  EXTRUSION_LAYER_ID,
  PROJECT_LINE_LAYER_ID
];

function asCoordinate(event: MapMouseEvent): Coordinate {
  return [event.lngLat.lng, event.lngLat.lat];
}

function asClientPoint(map: MapLibreMap, event: MapMouseEvent): { x: number; y: number } {
  const bounds = map.getContainer().getBoundingClientRect();
  return { x: bounds.left + event.point.x, y: bounds.top + event.point.y };
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function featureIdFromRenderedFeature(feature: { properties?: unknown }): FeatureId | null {
  const properties = feature.properties;
  if (!properties || typeof properties !== 'object') return null;
  const featureId = (properties as Record<string, unknown>).featureId;
  return typeof featureId === 'string' ? featureId : null;
}

function emptyProjectGeoJson(): ProjectGeoJson {
  return { type: 'FeatureCollection', features: [] };
}

/** MapLibre projection of the canonical ProjectDocumentV2. Geometry editing is deliberately absent. */
export class MapLibrePreviewRenderer implements MapRenderer {
  readonly map: MapLibreMap;
  private readonly options: MapLibrePreviewRendererOptions;
  private readonly mapClickListeners = new Set<(coordinate: Coordinate) => void>();
  private readonly mapViewListeners = new Set<(view: MapView) => void>();
  private readonly featureSelectListeners = new Set<(featureId: FeatureId | null) => void>();
  private readonly contextRequestListeners = new Set<(request: MapContextRequest) => void>();
  private readonly domMarkers = new Map<FeatureId, Marker>();
  private readonly domElements = new Map<FeatureId, HTMLElement>();
  private currentProject: ProjectDocumentV2 | null = null;
  private currentBasemapId = 'osm-standard';
  private selectedFeatureId: FeatureId | null = null;
  private previewExtrusions: Record<FeatureId, number> = {};
  private transientSearchMarker: Marker | null = null;
  private transientSearchNavigationActive = false;
  private suppressViewEvent = false;
  private styleReady = false;
  private overlayStyleReady = false;
  private labelsVisible = true;
  private initializationErrorReported = false;
  private readonly productionStyle: boolean;

  constructor(element: HTMLElement, options: MapLibrePreviewRendererOptions = {}) {
    this.options = options;
    this.productionStyle = options.style === undefined || options.style === OPENFREEMAP_BRIGHT_STYLE;
    if (options.forceFailure) {
      const error = new Error('Forced MapLibre initialization failure');
      options.onInitializationError?.(error);
      throw error;
    }
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
    this.map.on('load', this.handleLoad);
    this.map.on('error', this.handleMapError);
    this.map.on('click', this.handleMapClick);
    this.map.on('contextmenu', this.handleContextMenu);
    this.map.on('moveend', this.handleMoveEnd);
  }

  getCapabilities(): RendererCapabilities { return MAPLIBRE_CAPABILITIES; }

  getCameraPresentation(): CameraPresentation {
    return { pitchDeg: this.map.getPitch(), bearingDeg: this.map.getBearing() };
  }

  setCameraPresentation(presentation: CameraPresentation): void {
    this.map.setPitch(Math.min(60, Math.max(0, finiteOr(presentation.pitchDeg, 55))));
    this.map.setBearing(finiteOr(presentation.bearingDeg, -20));
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
    this.currentProject = clone(project);
    this.setView(project.mapView);
    if (this.selectedFeatureId && !project.features.some((feature) => feature.id === this.selectedFeatureId)) this.selectedFeatureId = null;
    if (this.styleReady) this.renderProjectOverlays();
  }

  upsertFeature(feature: ProjectFeature): void {
    if (!this.currentProject) return;
    const project = clone(this.currentProject);
    const index = project.features.findIndex((candidate) => candidate.id === feature.id);
    if (index < 0) project.features.push(clone(feature));
    else project.features[index] = clone(feature);
    this.renderProject(project);
  }

  removeFeature(featureId: string): void {
    if (!this.currentProject) return;
    this.currentProject.features = this.currentProject.features.filter((feature) => feature.id !== featureId);
    this.removeDomMarker(featureId);
    if (this.selectedFeatureId === featureId) this.selectFeature(null);
    else if (this.styleReady) this.renderProjectOverlays();
  }

  setFeatureVisibility(featureId: string, visible: boolean): void {
    if (!this.currentProject) return;
    const feature = this.currentProject.features.find((candidate) => candidate.id === featureId);
    if (!feature) return;
    feature.visible = visible;
    this.renderProjectOverlays();
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    this.domMarkers.forEach((marker, featureId) => {
      const element = this.domElements.get(featureId);
      const feature = this.currentProject?.features.find((candidate) => candidate.id === featureId);
      if (feature?.type === 'text') element?.classList.toggle('is-label-hidden', !visible);
      marker.getElement().style.opacity = feature?.type === 'text' && !visible ? '0' : '';
    });
  }

  setFeatureEditable(_featureId: string, _enabled: boolean): void {}
  toggleFeatureEditable(_featureId: string): void {}

  setPreviewExtrusions(extrusions: Readonly<Record<FeatureId, number>>): void {
    this.previewExtrusions = Object.fromEntries(Object.entries(extrusions).filter(([, height]) => Number.isFinite(height) && height > 0));
    if (this.styleReady) this.renderProjectOverlays();
  }

  selectFeature(featureId: string | null): void {
    this.selectedFeatureId = featureId && this.currentProject?.features.some((feature) => feature.id === featureId) ? featureId : null;
    this.updateDomSelection();
    if (this.styleReady) this.renderProjectOverlays();
  }

  fitFeature(featureId: string): void {
    const feature = this.currentProject?.features.find((candidate) => candidate.id === featureId);
    if (!feature) return;
    const bounds = new LngLatBounds();
    const addCoordinate = (coordinate: Coordinate): void => { bounds.extend([coordinate[0], coordinate[1]]); };
    if (feature.geometry.kind === 'point') addCoordinate(feature.geometry.coordinates);
    else if (feature.geometry.kind === 'lineString') feature.geometry.coordinates.forEach((coordinate) => { addCoordinate(coordinate); });
    else if (feature.geometry.kind === 'polygon') feature.geometry.coordinates.forEach((coordinate) => { addCoordinate(coordinate); });
    else if (feature.geometry.kind === 'bounds') {
      addCoordinate(feature.geometry.southWest);
      addCoordinate(feature.geometry.northEast);
    } else {
      addCoordinate(feature.geometry.center);
    }
    if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding: 80, maxZoom: 17 });
  }

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

  showSearchResult(preview: GeocodingPreview, onAdd: () => void): void {
    this.clearSearchResult();
    const element = document.createElement('div');
    element.className = 'maplibre-search-preview';
    const label = document.createElement('span');
    label.textContent = preview.label;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Add to project';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAdd();
    });
    element.append(label, button);
    this.transientSearchMarker = new Marker({ element, anchor: 'bottom' }).setLngLat([preview.coordinate[0], preview.coordinate[1]]).addTo(this.map);
    this.transientSearchNavigationActive = true;
    this.map.flyTo({ center: [preview.coordinate[0], preview.coordinate[1]], zoom: 16 });
  }

  clearSearchResult(): void {
    this.transientSearchMarker?.remove();
    this.transientSearchMarker = null;
    this.transientSearchNavigationActive = false;
  }

  getSearchResult(): HTMLElement | null {
    return this.transientSearchMarker?.getElement() ?? null;
  }

  runtimeSnapshot(): {
    markers: Array<{ id: FeatureId; label: string; coordinate: Coordinate }>;
    drawn: Array<{ id: FeatureId; type: ProjectFeature['type']; renderRole: string }>;
    previewExtrusions: Record<FeatureId, number>;
  } {
    const source = projectToGeoJson(this.currentProject ?? emptyProject(), {
      selectedFeatureId: this.selectedFeatureId,
      previewExtrusions: this.previewExtrusions
    });
    return {
      markers: projectToDomFeatures(this.currentProject ?? emptyProject()).map((item) => ({ id: item.featureId, label: item.label, coordinate: item.coordinate })),
      drawn: source.features.filter((item) => item.properties.renderRole !== 'marker' && item.properties.renderRole !== 'text').map((item) => ({ id: item.properties.featureId, type: item.properties.featureType, renderRole: item.properties.renderRole })),
      previewExtrusions: { ...this.previewExtrusions }
    };
  }

  getPreviewFeatureSnapshot(): Array<{ id: FeatureId; type: ProjectFeature['type']; heightM: number | null; visible: boolean; locked: boolean }> {
    const groups = new Map((this.currentProject?.groups ?? []).map((group) => [group.id, group]));
    return (this.currentProject?.features ?? []).map((feature) => {
      const group = feature.groupId ? groups.get(feature.groupId) : undefined;
      const state = effectiveState(feature, group);
      return { id: feature.id, type: feature.type, heightM: this.previewExtrusions[feature.id] ?? null, visible: state.visible, locked: state.locked };
    });
  }

  featureScreenPointForTest(featureId: FeatureId): { x: number; y: number } | null {
    const domElement = this.domElements.get(featureId);
    if (domElement) {
      const rect = domElement.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    const data = projectToGeoJson(this.currentProject ?? emptyProject(), {
      selectedFeatureId: this.selectedFeatureId,
      previewExtrusions: this.previewExtrusions
    });
    const candidate = data.features.find((item) => item.properties.featureId === featureId && item.properties.renderRole !== 'radius' && item.properties.renderRole !== 'arrowhead');
    if (!candidate) return null;
    const coordinates: Coordinate[] = [];
    const collect = (value: unknown): void => {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        coordinates.push([value[0], value[1]]);
      } else if (Array.isArray(value)) value.forEach(collect);
    };
    collect(candidate.geometry.coordinates);
    if (!coordinates.length) return null;
    const feature = this.currentProject?.features.find((item) => item.id === featureId);
    const longitudes = coordinates.map((item) => item[0]);
    const latitudes = coordinates.map((item) => item[1]);
    const coordinate: Coordinate = candidate.geometry.type === 'Polygon' && feature?.type === 'polygon'
      ? [Math.min(...longitudes) + (Math.max(...longitudes) - Math.min(...longitudes)) * 0.25, Math.min(...latitudes) + (Math.max(...latitudes) - Math.min(...latitudes)) * 0.55]
      : [
        coordinates.reduce((sum, item) => sum + item[0], 0) / coordinates.length,
        coordinates.reduce((sum, item) => sum + item[1], 0) / coordinates.length
      ];
    const point = this.map.project([coordinate[0], coordinate[1]]);
    const bounds = this.map.getContainer().getBoundingClientRect();
    return { x: bounds.left + point.x, y: bounds.top + point.y };
  }

  getGeoJsonSnapshot(): ProjectGeoJson {
    return projectToGeoJson(this.currentProject ?? emptyProject(), {
      selectedFeatureId: this.selectedFeatureId,
      previewExtrusions: this.previewExtrusions
    });
  }

  getProviderDiagnostics(): { styleReady: boolean; buildingSourceUrl: string | null; buildingLayer: boolean; buildingFeatureCount: number; projectLayers: string[]; styleLayerIds: string[]; sourceFeatureCount: number; attributionText: string } {
    const style = this.map.getStyle() ?? { sources: {} };
    const source = style.sources?.[BUILDING_SOURCE_ID] as { url?: string } | undefined;
    const buildingLayer = Boolean(this.map.getLayer(BUILDING_LAYER_ID));
    let buildingFeatureCount = 0;
    let sourceFeatureCount = 0;
    try {
      if (buildingLayer) buildingFeatureCount = this.map.queryRenderedFeatures({ layers: [BUILDING_LAYER_ID] }).length;
      if (this.map.getSource(PROJECT_SOURCE_ID)) sourceFeatureCount = this.map.querySourceFeatures(PROJECT_SOURCE_ID).length;
    } catch {
      // Diagnostics must remain safe while a provider style is still settling.
    }
    return {
      styleReady: this.styleReady,
      buildingSourceUrl: source?.url ?? null,
      buildingLayer,
      buildingFeatureCount,
      projectLayers: PROJECT_INTERACTIVE_LAYER_IDS.filter((id) => Boolean(this.map.getLayer(id))),
      styleLayerIds: style.layers?.map((layer) => layer.id) ?? [],
      sourceFeatureCount,
      attributionText: this.map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.textContent ?? ''
    };
  }

  featureHitIdsAtScreenPointForTest(point: { x: number; y: number }): FeatureId[] {
    const bounds = this.map.getContainer().getBoundingClientRect();
    try {
      const layers = PROJECT_INTERACTIVE_LAYER_IDS.filter((id) => Boolean(this.map.getLayer(id)));
      const rendered = (layers.length ? this.map.queryRenderedFeatures([point.x - bounds.left, point.y - bounds.top], { layers }) : []) as unknown as Array<{ properties?: unknown }>;
      return rendered
        .map(featureIdFromRenderedFeature)
        .filter((featureId): featureId is FeatureId => Boolean(featureId));
    } catch {
      return [];
    }
  }

  renderedFeatureDiagnosticsForTest(point: { x: number; y: number }): Array<{ source?: string; sourceLayer?: string; layer?: string; featureId?: string }> {
    const bounds = this.map.getContainer().getBoundingClientRect();
    try {
      return (this.map.queryRenderedFeatures([point.x - bounds.left, point.y - bounds.top]) as unknown as Array<{ source?: string; sourceLayer?: string; layer?: { id?: string }; properties?: unknown }>)
        .map((feature) => ({
          source: feature.source,
          sourceLayer: feature.sourceLayer,
          layer: feature.layer?.id,
          featureId: featureIdFromRenderedFeature(feature) ?? undefined
        }));
    } catch {
      return [];
    }
  }

  fireMapClickForTest(lat: number, lon: number): void {
    this.map.fire('click', {
      lngLat: { lat, lng: lon },
      point: { x: 0, y: 0 },
      preventDefault: () => undefined
    } as never);
  }

  destroy(): void {
    this.clearSearchResult();
    this.map.off('load', this.handleLoad);
    this.map.off('error', this.handleMapError);
    this.map.off('click', this.handleMapClick);
    this.map.off('contextmenu', this.handleContextMenu);
    this.map.off('moveend', this.handleMoveEnd);
    this.clearDomMarkers();
    this.map.remove();
    this.mapClickListeners.clear();
    this.mapViewListeners.clear();
    this.featureSelectListeners.clear();
    this.contextRequestListeners.clear();
    this.currentProject = null;
    this.previewExtrusions = {};
  }

  private readonly handleLoad = (): void => {
    this.styleReady = true;
    this.ensureOverlayStyle();
    this.renderProjectOverlays();
  };

  private readonly handleMapError = (event: unknown): void => {
    if (this.styleReady || this.initializationErrorReported) return;
    this.initializationErrorReported = true;
    const error = event && typeof event === 'object' && 'error' in event ? (event as { error?: unknown }).error : new Error('MapLibre style initialization failed');
    this.options.onInitializationError?.(error);
  };

  private readonly handleMapClick = (event: MapMouseEvent): void => {
    const featureId = this.featureIdAtPoint(event);
    if (featureId) {
      this.publishSelection(featureId);
      return;
    }
    const coordinate = asCoordinate(event);
    this.mapClickListeners.forEach((listener) => listener(coordinate));
  };

  private readonly handleContextMenu = (event: MapMouseEvent): void => {
    event.preventDefault();
    const coordinate = asCoordinate(event);
    this.publishContextRequest(this.featureIdAtPoint(event), coordinate, asClientPoint(this.map, event));
  };

  private readonly handleMoveEnd = (): void => {
    if (this.suppressViewEvent) return;
    if (this.transientSearchNavigationActive) {
      this.transientSearchNavigationActive = false;
      return;
    }
    const view = this.getView();
    this.mapViewListeners.forEach((listener) => listener(view));
  };

  private ensureOverlayStyle(): void {
    if (this.overlayStyleReady) return;
    if (this.productionStyle) this.ensureBuildingContext();
    this.map.addSource(PROJECT_SOURCE_ID, { type: 'geojson', data: emptyProjectGeoJson() } as never);
    this.addProjectLayer({
      id: RADIUS_FILL_LAYER_ID,
      type: 'fill',
      filter: ['==', ['get', 'renderRole'], 'radius'],
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': ['get', 'fillOpacity']
      }
    });
    this.addProjectLayer({
      id: RADIUS_LINE_LAYER_ID,
      type: 'line',
      filter: ['==', ['get', 'renderRole'], 'radius'],
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['get', 'opacity'],
        'line-width': ['get', 'weightPx']
      }
    });
    this.addProjectLayer({
      id: AREA_FILL_LAYER_ID,
      type: 'fill',
      filter: ['==', ['get', 'renderRole'], 'area'],
      paint: {
        'fill-color': ['case', ['get', 'selected'], '#f97316', ['get', 'fillColor']],
        'fill-opacity': ['case', ['get', 'selected'], 0.36, ['get', 'fillOpacity']]
      }
    });
    this.addProjectLayer({
      id: AREA_LINE_LAYER_ID,
      type: 'line',
      filter: ['==', ['get', 'renderRole'], 'area'],
      paint: {
        'line-color': ['case', ['get', 'selected'], '#f97316', ['get', 'color']],
        'line-opacity': ['get', 'opacity'],
        'line-width': ['+', ['get', 'weightPx'], ['case', ['get', 'selected'], 2, 0]]
      }
    });
    this.addProjectLayer({
      id: EXTRUSION_LAYER_ID,
      type: 'fill-extrusion',
      filter: ['all', ['==', ['get', 'renderRole'], 'area'], ['>', ['get', 'previewHeightM'], 0]],
      paint: {
        'fill-extrusion-color': ['case', ['get', 'selected'], '#f97316', ['get', 'fillColor']],
        'fill-extrusion-height': ['get', 'previewHeightM'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.68
      }
    });
    this.addProjectLayer({
      id: PROJECT_LINE_LAYER_ID,
      type: 'line',
      filter: ['any', ['==', ['get', 'renderRole'], 'line'], ['==', ['get', 'renderRole'], 'arrow-shaft'], ['==', ['get', 'renderRole'], 'arrowhead']],
      paint: {
        'line-color': ['case', ['get', 'selected'], '#f97316', ['get', 'color']],
        'line-opacity': ['get', 'opacity'],
        'line-width': ['+', ['get', 'weightPx'], ['case', ['get', 'selected'], 2, 0]]
      }
    });
    this.overlayStyleReady = true;
  }

  private ensureBuildingContext(): void {
    if (!this.map.getSource(BUILDING_SOURCE_ID)) {
      this.map.addSource(BUILDING_SOURCE_ID, { type: 'vector', url: OPENFREEMAP_PLANET_SOURCE } as never);
    }
    if (this.map.getLayer(BUILDING_LAYER_ID)) return;
    const firstSymbol = this.map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
    this.map.addLayer({
      id: BUILDING_LAYER_ID,
      type: 'fill-extrusion',
      source: BUILDING_SOURCE_ID,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#a8b4c4',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.58
      }
    } as never, firstSymbol);
  }

  private addProjectLayer(layer: Record<string, unknown>): void {
    this.map.addLayer({ source: PROJECT_SOURCE_ID, ...layer } as never);
  }

  private renderProjectOverlays(): void {
    if (!this.styleReady) return;
    this.ensureOverlayStyle();
    const data = projectToGeoJson(this.currentProject ?? emptyProject(), {
      selectedFeatureId: this.selectedFeatureId,
      previewExtrusions: this.previewExtrusions
    });
    const source = this.map.getSource(PROJECT_SOURCE_ID) as unknown as { setData(data: unknown): void } | undefined;
    source?.setData(data);
    this.renderDomMarkers();
  }

  private renderDomMarkers(): void {
    this.clearDomMarkers();
    if (!this.currentProject) return;
    projectToDomFeatures(this.currentProject).forEach((domFeature) => {
      const element = this.createDomFeatureElement(domFeature.featureId, domFeature.featureType, domFeature.label, domFeature.style, domFeature.effectiveLocked);
      const marker = new Marker({ element, anchor: domFeature.featureType === 'marker' ? 'bottom' : 'center' })
        .setLngLat([domFeature.coordinate[0], domFeature.coordinate[1]])
        .addTo(this.map);
      this.domMarkers.set(domFeature.featureId, marker);
      this.domElements.set(domFeature.featureId, element);
      if (domFeature.featureType === 'text' && !this.labelsVisible) element.classList.add('is-label-hidden');
    });
    this.updateDomSelection();
  }

  private createDomFeatureElement(featureId: FeatureId, featureType: 'marker' | 'text', label: string, style: ProjectFeature['style'], effectiveLocked: boolean): HTMLElement {
    const element = document.createElement('div');
    element.className = featureType === 'marker' ? 'maplibre-project-marker' : 'maplibre-project-text';
    element.dataset.featureId = featureId;
    element.dataset.featureType = featureType;
    element.dataset.locked = String(effectiveLocked);
    if (featureType === 'marker') {
      element.style.setProperty('--marker-color', style.color ?? '#2563eb');
      const symbol = document.createElement('span');
      symbol.textContent = style.symbolId && style.symbolId !== 'pin' ? style.symbolId.slice(0, 1).toUpperCase() : '•';
      element.appendChild(symbol);
    } else {
      element.textContent = label;
      element.style.color = style.color ?? '#1f2937';
      element.style.fontSize = `${style.fontSizePx ?? 14}px`;
      element.style.fontWeight = String(style.fontWeight ?? 600);
      element.style.textShadow = style.halo === false ? 'none' : '0 0 4px #fff, 0 0 4px #fff';
      element.style.setProperty('--text-rotation', `${style.rotationDeg ?? 0}deg`);
    }
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.publishSelection(featureId);
    });
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = this.map.getContainer().getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const coordinate = this.currentProject?.features.find((feature) => feature.id === featureId)?.geometry.kind === 'point'
        ? (this.currentProject?.features.find((feature) => feature.id === featureId)?.geometry as { coordinates: Coordinate }).coordinates
        : [this.map.getCenter().lng, this.map.getCenter().lat] as Coordinate;
      this.publishContextRequest(featureId, coordinate, { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 });
    });
    return element;
  }

  private clearDomMarkers(): void {
    this.domMarkers.forEach((marker) => marker.remove());
    this.domMarkers.clear();
    this.domElements.clear();
  }

  private removeDomMarker(featureId: FeatureId): void {
    this.domMarkers.get(featureId)?.remove();
    this.domMarkers.delete(featureId);
    this.domElements.delete(featureId);
  }

  private updateDomSelection(): void {
    this.domElements.forEach((element, featureId) => element.classList.toggle('workspace-selected-feature', featureId === this.selectedFeatureId));
  }

  private featureIdAtPoint(event: MapMouseEvent): FeatureId | null {
    if (!this.styleReady) return null;
    let rendered: ProjectGeoJsonFeature[] = [];
    try {
      const layers = PROJECT_INTERACTIVE_LAYER_IDS.filter((id) => Boolean(this.map.getLayer(id)));
      rendered = (layers.length ? this.map.queryRenderedFeatures(event.point, { layers }) : []) as unknown as ProjectGeoJsonFeature[];
    } catch {
      return null;
    }
    const ids = rendered.map(featureIdFromRenderedFeature).filter((featureId): featureId is FeatureId => Boolean(featureId));
    return ids[0] ?? null;
  }

  private publishSelection(featureId: FeatureId): void {
    this.selectFeature(featureId);
    this.featureSelectListeners.forEach((listener) => listener(featureId));
  }

  private publishContextRequest(featureId: FeatureId | null, coordinate: Coordinate, clientPoint: { x: number; y: number }): void {
    const request: MapContextRequest = { featureId, coordinate, clientPoint, source: 'mouse' };
    this.contextRequestListeners.forEach((listener) => listener(request));
  }
}

function emptyProject(): ProjectDocumentV2 {
  return {
    schemaVersion: 2,
    app: { name: 'map-tools', version: '2.0.0' },
    project: { id: 'empty', name: 'Empty', createdAt: '', updatedAt: '' },
    mapView: { center: [100.5018, 13.7563], zoom: 13, basemapId: 'osm-standard' },
    groups: [],
    features: []
  };
}
