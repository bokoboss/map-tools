import L from 'leaflet';
import { canMutateFeature, featureIsEffectivelyLocked } from '../../domain/mutationPolicy';
import type { Coordinate, FeatureId, FeatureStyle, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';
import { clone, effectiveState } from '../../domain/project';
import { formatArea, formatDistance, polygonAreaSquareMeters, polylineLength } from '../../measurement';
import { DEFAULT_BASEMAP_OPTIONS, type BasemapOption, type CameraPresentation, type FeatureAction, type FeatureChangePhase, type GeocodingPreview, type MapContextRequest, type MapRenderer, type RendererCapabilities } from '../renderer/MapRenderer';
import { fromLeafletLatLng, toLeafletLatLng, toLeafletLatLngs } from './coordinates';

type RuntimeLayer = L.Layer & {
  projectFeatureId?: string;
  projectName?: string;
  isArrow?: boolean;
  isTextLabel?: boolean;
};

type RuntimeMarker = L.Marker & RuntimeLayer & {
  labelText?: string;
  markerColor?: string;
  rotation?: number;
  radii?: Array<{ id: string; distance: number; color: string; fillOpacity: number }>;
  circleLayerGroup?: L.LayerGroup;
};

type RuntimeArrow = L.FeatureGroup & RuntimeLayer;

type RuntimePath = L.Path & {
  editing?: { enabled(): boolean; enable(): void; disable(): void };
};

export interface LeafletRendererCallbacks {
  onFeatureChanged(feature: ProjectFeature, phase?: FeatureChangePhase): void;
  onFeatureAction(action: FeatureAction, featureId: string): void;
  onFeatureSelected?(featureId: FeatureId | null): void;
  onFeatureInteractionStart?(featureId: FeatureId, label: string): void;
  onMapViewChanged?(view: MapView): void;
}

const LEAFLET_CAPABILITIES: RendererCapabilities = {
  mode: '2d',
  drawing: true,
  geometryEditing: true,
  featureDragging: true,
  basemapSwitching: true,
  pitchBearing: false,
  contextRequests: true
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function styleForLeaflet(style: FeatureStyle, defaults: FeatureStyle = {}): L.PathOptions {
  const merged = { ...defaults, ...style };
  return {
    color: merged.color ?? '#3388ff',
    weight: merged.weightPx ?? 4,
    opacity: merged.opacity ?? 1,
    fillColor: merged.fillColor ?? merged.color ?? '#3388ff',
    fillOpacity: merged.fillOpacity ?? 0.2,
    dashArray: merged.dashArray ?? undefined
  };
}

export class LeafletRenderer implements MapRenderer {
  readonly map: L.Map;
  private readonly canvasRenderer: L.Canvas;
  private readonly transientSearchLayer: L.LayerGroup;
  private readonly basemapLayers = new Map<string, L.Layer>();
  private readonly featureLayers = new Map<string, RuntimeLayer>();
  private readonly markerLayers = new Map<string, RuntimeMarker>();
  private readonly drawnLayers = new Map<string, RuntimeLayer>();
  private readonly mapClickListeners = new Set<(coordinate: Coordinate) => void>();
  private readonly mapViewListeners = new Set<(view: MapView) => void>();
  private readonly featureSelectListeners = new Set<(featureId: FeatureId | null) => void>();
  private readonly contextRequestListeners = new Set<(request: MapContextRequest) => void>();
  private readonly callbacks: LeafletRendererCallbacks;
  private currentBasemapId = 'osm-standard';
  private currentBaseLayer: L.Layer;
  private currentProject: ProjectDocumentV2 | null = null;
  private transientSearchMarker: RuntimeMarker | null = null;
  private suppressViewEvent = false;
  private ignoreNextMoveEnd = false;
  private transientSearchNavigationActive = false;
  private selectedFeatureId: string | null = null;
  private readonly activeFeatureInteractions = new Set<FeatureId>();

  constructor(element: HTMLElement, callbacks: LeafletRendererCallbacks) {
    this.callbacks = callbacks;
    this.map = L.map(element, { closePopupOnClick: false, zoomControl: false, drawControl: false }).setView([13.7563, 100.5018], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.canvasRenderer = L.canvas();
    this.transientSearchLayer = L.layerGroup().addTo(this.map);

    this.basemapLayers.set('osm-standard', L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }));
    this.basemapLayers.set('esri-imagery', L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }));
    this.basemapLayers.set('esri-hybrid', L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' }),
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { attribution: '© CARTO', pane: 'shadowPane' })
    ]));
    this.basemapLayers.set('opentopomap', L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap contributors | © OpenTopoMap' }));
    this.basemapLayers.set('osm-hot', L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors, HOT' }));
    this.basemapLayers.set('carto-light', L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '© CARTO' }));
    this.basemapLayers.set('carto-dark', L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '© CARTO' }));
    this.currentBaseLayer = this.basemapLayers.get(this.currentBasemapId)!;
    this.currentBaseLayer.addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const coordinate = fromLeafletLatLng(event.latlng);
      this.mapClickListeners.forEach((listener) => listener(coordinate));
    });
    this.map.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stop(event);
      this.publishContextRequest(null, event.latlng, event.containerPoint);
    });
    this.map.on('moveend', () => {
      if (this.ignoreNextMoveEnd) {
        this.ignoreNextMoveEnd = false;
        return;
      }
      if (this.transientSearchNavigationActive) {
        this.transientSearchNavigationActive = false;
        return;
      }
      if (!this.suppressViewEvent) {
        const view = this.getView();
        this.callbacks.onMapViewChanged?.(view);
        this.mapViewListeners.forEach((listener) => listener(view));
      }
    });
  }

  getCapabilities(): RendererCapabilities { return LEAFLET_CAPABILITIES; }

  getCameraPresentation(): CameraPresentation { return { pitchDeg: 0, bearingDeg: 0 }; }

  setCameraPresentation(_presentation: CameraPresentation): void {
    // Leaflet has no pitch/bearing camera. The renderer-neutral presentation remains zero.
  }

  getMapForDrawing(): L.Map {
    return this.map;
  }

  setView(view: MapView): void {
    this.transientSearchNavigationActive = false;
    const current = this.map.getCenter();
    const changed = Math.abs(current.lat - view.center[1]) > 1e-9 || Math.abs(current.lng - view.center[0]) > 1e-9 || this.map.getZoom() !== view.zoom;
    this.ignoreNextMoveEnd = changed;
    this.suppressViewEvent = true;
    this.map.setView(toLeafletLatLng(view.center), view.zoom);
    this.suppressViewEvent = false;
  }

  getView(): MapView {
    const center = this.map.getCenter();
    return { center: fromLeafletLatLng(center), zoom: this.map.getZoom(), basemapId: this.currentBasemapId };
  }

  renderProject(project: ProjectDocumentV2): void {
    this.currentProject = clone(project);
    this.setView(project.mapView);
    this.setBasemap(project.mapView.basemapId);
    this.clearProjectLayers();
    const groups = new Map(project.groups.map((group) => [group.id, group]));
    project.features.forEach((feature) => this.renderFeature(feature, groups.get(feature.groupId ?? '')));
    if (this.selectedFeatureId && !project.features.some((feature) => feature.id === this.selectedFeatureId)) this.selectedFeatureId = null;
    this.applySelectionHighlight();
  }

  upsertFeature(feature: ProjectFeature): void {
    if (!this.currentProject) return;
    const project = clone(this.currentProject);
    const index = project.features.findIndex((item) => item.id === feature.id);
    if (index < 0) project.features.push(clone(feature));
    else project.features[index] = clone(feature);
    this.renderProject(project);
  }

  removeFeature(featureId: string): void {
    this.removeRuntimeFeature(featureId);
    if (this.currentProject) this.currentProject.features = this.currentProject.features.filter((feature) => feature.id !== featureId);
  }

  setFeatureVisibility(featureId: string, visible: boolean): void {
    const layer = this.featureLayers.get(featureId);
    if (!layer) return;
    if (visible) this.map.addLayer(layer);
    else this.map.removeLayer(layer);
    const marker = this.markerLayers.get(featureId);
    if (marker?.circleLayerGroup) {
      if (visible) this.map.addLayer(marker.circleLayerGroup);
      else this.map.removeLayer(marker.circleLayerGroup);
    }
  }

  setLabelsVisible(visible: boolean): void {
    for (const marker of this.markerLayers.values()) {
      if (visible) marker.openPopup();
      else marker.closePopup();
    }
  }

  setFeatureEditable(featureId: string, enabled: boolean): void {
    if (enabled && this.isFeatureLocked(featureId)) return;
    const layer = this.featureLayers.get(featureId);
    const target = this.editTarget(layer);
    if (!target?.editing) return;
    if (enabled) target.editing.enable();
    else target.editing.disable();
  }

  toggleFeatureEditable(featureId: string): void {
    if (this.isFeatureLocked(featureId)) return;
    const layer = this.featureLayers.get(featureId);
    const target = this.editTarget(layer);
    if (!target?.editing) return;
    if (target.editing.enabled()) target.editing.disable();
    else target.editing.enable();
  }

  selectFeature(featureId: string | null): void {
    this.selectedFeatureId = featureId && this.currentProject?.features.some((feature) => feature.id === featureId) ? featureId : null;
    this.applySelectionHighlight();
  }

  fitFeature(featureId: string): void {
    const layer = this.featureLayers.get(featureId);
    if (!layer) return;
    if (layer instanceof L.Marker) this.map.panTo(layer.getLatLng());
    else if (layer instanceof L.Circle) this.map.fitBounds(layer.getBounds());
    else if (layer instanceof L.FeatureGroup || layer instanceof L.Polygon || layer instanceof L.Polyline || layer instanceof L.Rectangle) this.map.fitBounds((layer as L.FeatureGroup).getBounds());
  }

  setBasemap(basemapId: string): boolean {
    const next = this.basemapLayers.get(basemapId);
    if (!next) return false;
    if (next !== this.currentBaseLayer) {
      this.map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = next;
      this.currentBaseLayer.addTo(this.map);
    }
    this.currentBasemapId = basemapId;
    return true;
  }

  getBasemapId(): string { return this.currentBasemapId; }
  getBasemapOptions(): readonly BasemapOption[] { return DEFAULT_BASEMAP_OPTIONS; }

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

  cancelActiveInteractions(): void {
    for (const layer of this.featureLayers.values()) this.editTarget(layer)?.editing?.disable();
    this.activeFeatureInteractions.clear();
  }

  setPreviewExtrusions(_extrusions: Readonly<Record<string, number>>): void {
    // Preview extrusion is a MapLibre-only transient projection.
  }

  showSearchResult(preview: GeocodingPreview, onAdd: () => void): void {
    this.clearSearchResult();
    const target = toLeafletLatLng(preview.coordinate);
    const current = this.map.getCenter();
    const needsNavigation = current.lat !== target[0] || current.lng !== target[1] || this.map.getZoom() !== 16;
    this.ignoreNextMoveEnd = false;
    this.transientSearchNavigationActive = needsNavigation;
    if (needsNavigation) this.map.flyTo(target, 16);
    const marker = L.marker(toLeafletLatLng(preview.coordinate), { icon: this.createMarkerIcon('#475569') }) as RuntimeMarker;
    marker.addTo(this.transientSearchLayer);
    marker.projectFeatureId = `transient-${Date.now()}`;
    const content = document.createElement('div');
    const label = document.createElement('div');
    label.textContent = preview.label;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Add to project';
    button.className = 'mt-2 rounded bg-blue-600 px-2 py-1 text-white';
    button.addEventListener('click', () => onAdd());
    content.append(label, button);
    marker.bindPopup(content, { autoClose: false, closeButton: false, autoPan: false }).openPopup();
    this.transientSearchMarker = marker;
  }

  clearSearchResult(): void {
    if (this.transientSearchMarker) this.transientSearchLayer.removeLayer(this.transientSearchMarker);
    this.transientSearchMarker = null;
  }

  getSearchResult(): RuntimeMarker | null { return this.transientSearchMarker; }

  getMarkers(): RuntimeMarker[] { return Array.from(this.markerLayers.values()); }
  getDrawnLayers(): RuntimeLayer[] { return Array.from(this.drawnLayers.values()); }

  featureIdForRuntimeLayer(layer: unknown): string | null {
    if (layer && typeof layer === 'object') {
      const direct = (layer as RuntimeLayer).projectFeatureId;
      if (direct) return direct;
    }
    for (const [featureId, candidate] of this.featureLayers) if (L.Util.stamp(candidate) === layer) return featureId;
    return null;
  }

  featureIdForRuntimeId(runtimeId: number): string | null {
    for (const [featureId, layer] of this.featureLayers) if (L.Util.stamp(layer) === runtimeId) return featureId;
    return null;
  }

  runtimeSnapshot(): {
    markers: Array<{ id?: string; label?: string; latlng: [number, number]; radii: Array<{ id: string; distance: number }>; circles: Array<{ center: [number, number]; radius: number }> }>;
    drawn: Array<Record<string, unknown>>;
  } {
    return {
      markers: this.getMarkers().map((marker) => ({
        id: marker.projectFeatureId,
        label: marker.labelText,
        latlng: [marker.getLatLng().lat, marker.getLatLng().lng],
        radii: (marker.radii ?? []).map((radius) => ({ id: String(radius.id), distance: Number(radius.distance) })),
        circles: marker.circleLayerGroup?.getLayers().filter((layer): layer is L.Circle => layer instanceof L.Circle).map((circle) => ({ center: [circle.getLatLng().lat, circle.getLatLng().lng], radius: circle.getRadius() })) ?? []
      })),
      drawn: this.getDrawnLayers().map((layer) => this.runtimeLayerSnapshot(layer))
    };
  }

  fireMapClickForTest(lat: number, lon: number): void {
    this.map.fire('click', { latlng: L.latLng(lat, lon) } as unknown as L.LeafletMouseEvent);
  }

  destroy(): void {
    this.clearSearchResult();
    this.clearProjectLayers();
    this.map.off();
    this.map.remove();
    this.featureLayers.clear();
    this.markerLayers.clear();
    this.drawnLayers.clear();
    this.currentProject = null;
  }

  private clearProjectLayers(): void {
    for (const layer of this.featureLayers.values()) this.map.removeLayer(layer);
    for (const marker of this.markerLayers.values()) if (marker.circleLayerGroup) this.map.removeLayer(marker.circleLayerGroup);
    this.featureLayers.clear();
    this.markerLayers.clear();
    this.drawnLayers.clear();
  }

  private removeRuntimeFeature(featureId: string): void {
    const layer = this.featureLayers.get(featureId);
    if (layer) this.map.removeLayer(layer);
    const marker = this.markerLayers.get(featureId);
    if (marker?.circleLayerGroup) this.map.removeLayer(marker.circleLayerGroup);
    this.featureLayers.delete(featureId);
    this.markerLayers.delete(featureId);
    this.drawnLayers.delete(featureId);
  }

  private renderFeature(feature: ProjectFeature, group?: { visible: boolean; locked: boolean }): void {
    const state = effectiveState(feature, group);
    if (feature.type === 'marker') {
      const marker = this.createMarkerLayer(feature, state.locked);
      this.featureLayers.set(feature.id, marker);
      this.markerLayers.set(feature.id, marker);
      if (state.visible) {
        marker.addTo(this.map);
        marker.circleLayerGroup?.addTo(this.map);
      }
      return;
    }
    const layer = feature.type === 'text' ? this.createTextLayer(feature, state.locked) : this.createShapeLayer(feature, state.locked);
    if (!layer) return;
    this.featureLayers.set(feature.id, layer);
    this.drawnLayers.set(feature.id, layer);
    if (state.visible) layer.addTo(this.map);
  }

  private publishSelection(featureId: FeatureId | null): void {
    this.selectFeature(featureId);
    this.callbacks.onFeatureSelected?.(featureId);
    this.featureSelectListeners.forEach((listener) => listener(featureId));
  }

  private publishContextRequest(featureId: FeatureId | null, latlng: L.LatLng, containerPoint?: L.Point): void {
    const point = containerPoint ?? this.map.latLngToContainerPoint(latlng);
    const bounds = this.map.getContainer().getBoundingClientRect();
    const request: MapContextRequest = {
      featureId,
      coordinate: fromLeafletLatLng(latlng),
      clientPoint: { x: bounds.left + point.x, y: bounds.top + point.y },
      source: 'mouse'
    };
    this.contextRequestListeners.forEach((listener) => listener(request));
  }

  private isFeatureLocked(featureId: FeatureId): boolean {
    return this.currentProject ? featureIsEffectivelyLocked(this.currentProject, featureId) : false;
  }

  private restoreFeatureRuntime(featureId: FeatureId): void {
    if (!this.currentProject) return;
    const feature = this.currentProject.features.find((candidate) => candidate.id === featureId);
    if (feature) this.renderProject(this.currentProject);
  }

  private applySelectionHighlight(): void {
    const selectedId = this.selectedFeatureId;
    for (const [featureId, layer] of this.featureLayers) {
      const selected = featureId === selectedId;
      if (layer instanceof L.Marker) {
        layer.getElement()?.classList.toggle('workspace-selected-feature', selected);
        continue;
      }
      const feature = this.currentProject?.features.find((candidate) => candidate.id === featureId);
      if (!feature) continue;
      const target = this.editTarget(layer);
      if (!target || !(target instanceof L.Path)) continue;
      const base = styleForLeaflet(feature.style, feature.type === 'arrow' ? { color: '#10b981', weightPx: 3 } : {});
      target.setStyle(selected ? { ...base, color: '#f97316', weight: (base.weight ?? 4) + 2 } : base);
    }
  }

  private createMarkerLayer(feature: Extract<ProjectFeature, { type: 'marker' }>, locked: boolean): RuntimeMarker {
    const marker = L.marker(toLeafletLatLng(feature.geometry.coordinates), { draggable: !locked, icon: this.createMarkerIcon(feature.style.color ?? '#2563eb') }) as RuntimeMarker;
    marker.projectFeatureId = feature.id;
    marker.projectName = feature.name;
    marker.labelText = feature.name;
    marker.markerColor = feature.style.color ?? '#2563eb';
    marker.radii = feature.properties.radii.map((radius) => ({ id: radius.id, distance: radius.distanceM, color: radius.color, fillOpacity: radius.fillOpacity }));
    marker.circleLayerGroup = L.layerGroup();
    marker.bindPopup(this.createMarkerPopupContent(feature), { autoClose: false, closeButton: false });
    marker.on('click', () => this.publishSelection(feature.id));
    marker.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stop(event);
      this.publishContextRequest(feature.id, event.latlng, event.containerPoint);
    });
    marker.on('dragstart', () => {
      if (this.isFeatureLocked(feature.id)) return;
      marker.closePopup();
      this.activeFeatureInteractions.add(feature.id);
      this.callbacks.onFeatureInteractionStart?.(feature.id, `Move ${feature.name}`);
    });
    marker.on('drag', () => this.drawCirclesForMarker(marker));
    marker.on('dragend', () => {
      if (this.isFeatureLocked(feature.id)) {
        this.restoreFeatureRuntime(feature.id);
        this.activeFeatureInteractions.delete(feature.id);
        return;
      }
      this.publishFeature(feature.id, marker, 'commit');
      this.activeFeatureInteractions.delete(feature.id);
    });
    this.drawCirclesForMarker(marker);
    return marker;
  }

  private createTextLayer(feature: Extract<ProjectFeature, { type: 'text' }>, locked: boolean): RuntimeMarker {
    const marker = L.marker(toLeafletLatLng(feature.geometry.coordinates), { icon: this.createTextIcon(feature.properties.text, feature.style.rotationDeg ?? 0), draggable: !locked }) as RuntimeMarker;
    marker.projectFeatureId = feature.id;
    marker.projectName = feature.name;
    marker.labelText = feature.properties.text;
    marker.rotation = feature.style.rotationDeg ?? 0;
    marker.isTextLabel = true;
    marker.bindPopup(this.createMarkerPopupContent(feature), { autoClose: false, closeButton: false });
    marker.on('click', () => this.publishSelection(feature.id));
    marker.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stop(event);
      this.publishContextRequest(feature.id, event.latlng, event.containerPoint);
    });
    marker.on('dragstart', () => {
      if (this.isFeatureLocked(feature.id)) return;
      this.activeFeatureInteractions.add(feature.id);
      this.callbacks.onFeatureInteractionStart?.(feature.id, `Move ${feature.name}`);
    });
    marker.on('dragend', () => {
      if (this.isFeatureLocked(feature.id)) {
        this.restoreFeatureRuntime(feature.id);
        this.activeFeatureInteractions.delete(feature.id);
        return;
      }
      this.publishFeature(feature.id, marker, 'commit');
      this.activeFeatureInteractions.delete(feature.id);
    });
    return marker;
  }

  private createShapeLayer(feature: Exclude<ProjectFeature, { type: 'marker' | 'text' }>, locked: boolean): RuntimeLayer | null {
    const style = styleForLeaflet(feature.style, feature.type === 'arrow' ? { color: '#10b981', weightPx: 3 } : {});
    let layer: RuntimeLayer;
    if (feature.type === 'polyline') layer = L.polyline(toLeafletLatLngs(feature.geometry.coordinates), style) as RuntimeLayer;
    else if (feature.type === 'polygon') layer = L.polygon(toLeafletLatLngs(feature.geometry.coordinates), style) as RuntimeLayer;
    else if (feature.type === 'rectangle') layer = L.rectangle([toLeafletLatLng(feature.geometry.southWest), toLeafletLatLng(feature.geometry.northEast)], style) as RuntimeLayer;
    else if (feature.type === 'circle') layer = L.circle(toLeafletLatLng(feature.geometry.center), { ...style, radius: feature.geometry.radiusM, renderer: this.canvasRenderer }) as RuntimeLayer;
    else layer = this.createArrowLayer(feature.geometry.coordinates, style.color ?? '#10b981', style.weight ?? 3);
    layer.projectFeatureId = feature.id;
    layer.projectName = feature.name;
    if (feature.type === 'arrow') layer.isArrow = true;
    if (feature.type === 'arrow') this.bindShapeLayer(feature.id, layer, locked);
    else this.bindShapeLayer(feature.id, layer, locked);
    return layer;
  }

  private bindShapeLayer(featureId: string, layer: RuntimeLayer, locked: boolean): void {
    const target = this.editTarget(layer);
    if (target && 'bindPopup' in target) {
      (target as L.Path).bindPopup(() => this.createShapePopupContent(featureId), { autoClose: true, closeOnClick: true });
      target.on('contextmenu', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event);
        this.publishContextRequest(featureId, event.latlng, event.containerPoint);
      });
      if (layer.isArrow && layer instanceof L.FeatureGroup) {
        const head = layer.getLayers().find((item) => item instanceof L.Marker);
        head?.on('contextmenu', (event: L.LeafletMouseEvent) => {
          L.DomEvent.stop(event);
          this.publishContextRequest(featureId, event.latlng, event.containerPoint);
        });
      }
      target.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event);
        this.publishSelection(featureId);
        if (target.isPopupOpen()) target.closePopup();
        else target.openPopup(event.latlng);
      });
      target.on('editstart', () => {
        if (this.isFeatureLocked(featureId)) {
          target.editing?.disable();
          return;
        }
        this.activeFeatureInteractions.add(featureId);
        const feature = this.currentProject?.features.find((candidate) => candidate.id === featureId);
        this.callbacks.onFeatureInteractionStart?.(featureId, `Edit ${feature?.name ?? 'feature'} geometry`);
      });
      target.on('edit', () => {
        if (this.isFeatureLocked(featureId) || !this.currentProject || !canMutateFeature(this.currentProject, featureId, 'geometry')) {
          this.restoreFeatureRuntime(featureId);
          return;
        }
        if (layer.isArrow) this.updateArrowHead(layer);
        if (!this.activeFeatureInteractions.has(featureId)) this.publishFeature(featureId, layer, 'commit');
      });
      target.on('editend', () => {
        if (this.isFeatureLocked(featureId)) {
          this.restoreFeatureRuntime(featureId);
          this.activeFeatureInteractions.delete(featureId);
          return;
        }
        this.publishFeature(featureId, layer, 'commit');
        this.activeFeatureInteractions.delete(featureId);
      });
      if (locked && target.editing) target.editing.disable();
    }
  }

  private editTarget(layer?: RuntimeLayer): RuntimePath | null {
    if (!layer) return null;
    if (layer.isArrow && layer instanceof L.FeatureGroup) {
      const line = layer.getLayers().find((item) => item instanceof L.Polyline) as RuntimePath | undefined;
      return line ?? null;
    }
    return layer as RuntimePath;
  }

  private createArrowLayer(coordinates: readonly Coordinate[], color: string, weight: number): RuntimeArrow {
    const line = L.polyline(toLeafletLatLngs(coordinates), { color, weight }) as RuntimePath;
    const head = L.marker(toLeafletLatLng(coordinates[coordinates.length - 1]), { icon: this.createArrowIcon(color, 0) });
    const group = L.featureGroup([line, head]) as RuntimeArrow;
    group.isArrow = true;
    return group;
  }

  private updateArrowHead(layer: RuntimeLayer): void {
    if (!layer.isArrow || !(layer instanceof L.FeatureGroup)) return;
    const line = layer.getLayers().find((item) => item instanceof L.Polyline) as L.Polyline | undefined;
    const head = layer.getLayers().find((item) => item instanceof L.Marker) as L.Marker | undefined;
    if (!line || !head) return;
    const latlngs = line.getLatLngs() as L.LatLng[];
    if (latlngs.length < 2) return;
    const last = latlngs[latlngs.length - 1];
    const previous = latlngs[latlngs.length - 2];
    head.setLatLng(last);
    const p1 = this.map.latLngToContainerPoint(previous);
    const p2 = this.map.latLngToContainerPoint(last);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    const color = ((line as L.Polyline).options.color as string | undefined) ?? '#10b981';
    head.setIcon(this.createArrowIcon(color, angle + 90));
  }

  private createMarkerIcon(color: string): L.DivIcon {
    const svg = `<div class="custom-marker-icon"><svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5 0 19.404 12.5 41 12.5 41S25 19.404 25 12.5C25 5.596 19.404 0 12.5 0z" fill="${escapeHtml(color)}"/><circle cx="12.5" cy="12.5" r="4.5" fill="white"/></svg></div>`;
    return L.divIcon({ html: svg, className: '', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -36] });
  }

  private createTextIcon(text: string, rotation: number): L.DivIcon {
    const safeRotation = Number.isFinite(rotation) ? rotation : 0;
    return L.divIcon({ className: 'text-label-icon', html: `<div style="transform: rotate(${safeRotation}deg);">${escapeHtml(text)}</div>` });
  }

  private createArrowIcon(color: string, rotation: number): L.DivIcon {
    const safeRotation = Number.isFinite(rotation) ? rotation : 0;
    return L.divIcon({
      className: 'arrow-head',
      html: `<div style="transform: rotate(${safeRotation}deg); transform-origin: center center;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${escapeHtml(color)}" width="24" height="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  private drawCirclesForMarker(marker: RuntimeMarker): void {
    marker.circleLayerGroup?.clearLayers();
    const latlng = marker.getLatLng();
    (marker.radii ?? []).forEach((radius) => {
      L.circle(latlng, { renderer: this.canvasRenderer, radius: radius.distance, color: radius.color, fillColor: radius.color, fillOpacity: radius.fillOpacity, interactive: false }).addTo(marker.circleLayerGroup!);
    });
  }

  private createMarkerPopupContent(feature: ProjectFeature): HTMLElement {
    const container = document.createElement('div');
    container.className = 'editable-popup-text';
    const label = document.createElement('b');
    label.textContent = feature.name;
    container.appendChild(label);
    const actions = document.createElement('div');
    actions.className = 'popup-actions';
    const locked = this.currentProject ? featureIsEffectivelyLocked(this.currentProject, feature.id) : false;
    const addAction = (text: string, action: FeatureAction): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.title = text;
      button.disabled = locked;
      button.setAttribute('aria-disabled', String(locked));
      button.addEventListener('click', () => this.callbacks.onFeatureAction(action, feature.id));
      actions.appendChild(button);
    };
    if (feature.type === 'marker') {
      addAction('Edit', 'edit');
      addAction('Radii', 'edit-radius');
      addAction('Delete', 'delete');
    } else if (feature.type === 'text') {
      addAction('Edit', 'edit');
      addAction('Rotate', 'rotate');
      addAction('Delete', 'delete');
    }
    container.appendChild(actions);
    container.addEventListener('dblclick', () => {
      if (!locked) this.callbacks.onFeatureAction('edit', feature.id);
    });
    return container;
  }

  private createShapePopupContent(featureId: string): HTMLElement {
    const feature = this.currentProject?.features.find((item) => item.id === featureId);
    const container = document.createElement('div');
    if (!feature) return container;
    const target = this.featureLayers.get(featureId);
    const measurement = document.createElement('div');
    if (feature.type === 'polygon' && feature.geometry.kind === 'polygon') measurement.textContent = formatArea(polygonAreaSquareMeters(feature.geometry.coordinates));
    else if ((feature.type === 'polyline' || feature.type === 'arrow') && feature.geometry.kind === 'lineString') measurement.textContent = formatDistance(polylineLength(feature.geometry.coordinates));
    else if (feature.type === 'circle' && feature.geometry.kind === 'circle') measurement.textContent = `${formatDistance(feature.geometry.radiusM)}\n${formatArea(Math.PI * feature.geometry.radiusM ** 2)}`;
    container.appendChild(measurement);
    const actions = document.createElement('div');
    actions.className = 'flex items-center justify-around mt-2';
    const locked = this.currentProject ? featureIsEffectivelyLocked(this.currentProject, featureId) : false;
    const addAction = (label: string, action: FeatureAction): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'p-2 rounded-full hover:bg-gray-200';
      button.title = label;
      button.textContent = label;
      button.disabled = locked;
      button.setAttribute('aria-disabled', String(locked));
      button.addEventListener('click', () => this.callbacks.onFeatureAction(action, featureId));
      actions.appendChild(button);
    };
    addAction('Edit', 'toggle-edit');
    addAction('Color', 'edit-style');
    addAction('Delete', 'delete');
    container.appendChild(actions);
    if (!target) container.remove();
    return container;
  }

  private publishFeature(featureId: string, runtimeOverride?: RuntimeLayer, phase: FeatureChangePhase = 'commit'): void {
    const feature = this.featureFromRuntime(featureId, runtimeOverride);
    if (feature) this.callbacks.onFeatureChanged(feature, phase);
  }

  private featureFromRuntime(featureId: string, runtimeOverride?: RuntimeLayer): ProjectFeature | null {
    const original = this.currentProject?.features.find((feature) => feature.id === featureId);
    const runtime = runtimeOverride ?? this.featureLayers.get(featureId);
    if (!original || !runtime) return null;
    const feature = clone(original);
    if (feature.type === 'marker' && runtime instanceof L.Marker) {
      const marker = runtime as RuntimeMarker;
      feature.geometry = { kind: 'point', coordinates: fromLeafletLatLng(marker.getLatLng()) };
      feature.name = marker.labelText ?? feature.name;
      feature.style = { ...feature.style, color: marker.markerColor ?? feature.style.color };
      feature.properties.radii = (marker.radii ?? []).map((radius) => ({ id: radius.id, distanceM: radius.distance, color: radius.color, fillOpacity: radius.fillOpacity }));
    } else if (feature.type === 'text' && runtime instanceof L.Marker) {
      const marker = runtime as RuntimeMarker;
      feature.geometry = { kind: 'point', coordinates: fromLeafletLatLng(marker.getLatLng()) };
      feature.name = marker.labelText ?? feature.name;
      feature.properties.text = marker.labelText ?? feature.properties.text;
      feature.style = { ...feature.style, rotationDeg: marker.rotation ?? feature.style.rotationDeg ?? 0 };
    } else if (feature.type === 'arrow' && runtime.isArrow && runtime instanceof L.FeatureGroup) {
      const line = runtimeOverride instanceof L.Polyline ? runtimeOverride : runtime.getLayers().find((item) => item instanceof L.Polyline) as L.Polyline | undefined;
      if (!line) return null;
      feature.geometry = { kind: 'lineString', coordinates: (line.getLatLngs() as L.LatLng[]).map(fromLeafletLatLng) };
      feature.style = { ...feature.style, color: line.options.color ?? feature.style.color, weightPx: line.options.weight ?? feature.style.weightPx };
    } else if (feature.type === 'polyline' && runtime instanceof L.Polyline) {
      feature.geometry = { kind: 'lineString', coordinates: (runtime.getLatLngs() as L.LatLng[]).map(fromLeafletLatLng) };
      feature.style = this.styleFromRuntime(runtime, feature.style);
    } else if (feature.type === 'polygon' && runtime instanceof L.Polygon) {
      const coordinates = runtime.getLatLngs()[0] as L.LatLng[];
      feature.geometry = { kind: 'polygon', coordinates: coordinates.map(fromLeafletLatLng) };
      feature.style = this.styleFromRuntime(runtime, feature.style);
    } else if (feature.type === 'rectangle' && runtime instanceof L.Rectangle) {
      const bounds = runtime.getBounds();
      feature.geometry = { kind: 'bounds', southWest: fromLeafletLatLng(bounds.getSouthWest()), northEast: fromLeafletLatLng(bounds.getNorthEast()) };
      feature.style = this.styleFromRuntime(runtime, feature.style);
    } else if (feature.type === 'circle' && runtime instanceof L.Circle) {
      feature.geometry = { kind: 'circle', center: fromLeafletLatLng(runtime.getLatLng()), radiusM: runtime.getRadius() };
      feature.style = this.styleFromRuntime(runtime, feature.style);
    } else return null;
    return feature;
  }

  private styleFromRuntime(layer: L.Path, original: FeatureStyle): FeatureStyle {
    const options = layer.options;
    return {
      ...original,
      color: options.color ?? original.color,
      fillColor: options.fillColor ?? original.fillColor,
      weightPx: options.weight ?? original.weightPx,
      opacity: options.opacity ?? original.opacity,
      fillOpacity: options.fillOpacity ?? original.fillOpacity
    };
  }

  private runtimeLayerSnapshot(layer: RuntimeLayer): Record<string, unknown> {
    if (layer.isArrow && layer instanceof L.FeatureGroup) {
      const line = layer.getLayers().find((item) => item instanceof L.Polyline) as L.Polyline;
      const head = layer.getLayers().find((item) => item instanceof L.Marker) as L.Marker;
      return { type: 'arrow', line: (line.getLatLngs() as L.LatLng[]).map((latlng) => [latlng.lat, latlng.lng]), head: [head.getLatLng().lat, head.getLatLng().lng] };
    }
    if (layer.isTextLabel && layer instanceof L.Marker) return { type: 'text', text: (layer as RuntimeMarker).labelText, latlng: [layer.getLatLng().lat, layer.getLatLng().lng], rotation: Number((layer as RuntimeMarker).rotation ?? 0) };
    if (layer instanceof L.Circle) return { type: 'circle', center: [layer.getLatLng().lat, layer.getLatLng().lng], radius: layer.getRadius() };
    if (layer instanceof L.Rectangle) {
      const bounds = layer.getBounds();
      return { type: 'rectangle', bounds: [[bounds.getSouthWest().lat, bounds.getSouthWest().lng], [bounds.getNorthEast().lat, bounds.getNorthEast().lng]] };
    }
    if (layer instanceof L.Polygon) return { type: 'polygon', coordinates: (layer.getLatLngs()[0] as L.LatLng[]).map((latlng) => [latlng.lat, latlng.lng]) };
    if (layer instanceof L.Polyline) return { type: 'polyline', coordinates: (layer.getLatLngs() as L.LatLng[]).map((latlng) => [latlng.lat, latlng.lng]) };
    return { type: 'unknown' };
  }
}

export { fromLeafletLatLng, toLeafletLatLng, toLeafletLatLngs } from './coordinates';
