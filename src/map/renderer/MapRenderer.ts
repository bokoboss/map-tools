import type { Coordinate, FeatureId, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';

export interface BasemapOption {
  id: string;
  label: string;
}

export const DEFAULT_BASEMAP_OPTIONS: readonly BasemapOption[] = [
  { id: 'osm-standard', label: 'Standard map' },
  { id: 'esri-imagery', label: 'Satellite imagery' },
  { id: 'esri-hybrid', label: 'Satellite hybrid' },
  { id: 'opentopomap', label: 'Topographic map' },
  { id: 'osm-hot', label: 'Humanitarian (HOT)' },
  { id: 'carto-light', label: 'Light map' },
  { id: 'carto-dark', label: 'Dark map' }
];

export type RendererMode = '2d' | '3d-preview';

export interface RendererCapabilities {
  mode: RendererMode;
  drawing: boolean;
  geometryEditing: boolean;
  featureDragging: boolean;
  basemapSwitching: boolean;
  pitchBearing: boolean;
  contextRequests: boolean;
}

export interface CameraPresentation {
  pitchDeg: number;
  bearingDeg: number;
}

export type FeatureAction = 'edit' | 'edit-style' | 'edit-radius' | 'delete' | 'toggle-edit' | 'rotate';

export interface GeocodingPreview {
  label: string;
  coordinate: Coordinate;
}

export interface MapContextRequest {
  featureId: FeatureId | null;
  coordinate: Coordinate;
  clientPoint: { x: number; y: number };
  source: 'mouse' | 'keyboard' | 'touch';
}

export type FeatureChangePhase = 'update' | 'commit';

export interface MapRenderer {
  getCapabilities(): RendererCapabilities;
  getCameraPresentation(): CameraPresentation;
  setCameraPresentation(presentation: CameraPresentation): void;
  setView(view: MapView): void;
  getView(): MapView;
  renderProject(project: ProjectDocumentV2): void;
  upsertFeature(feature: ProjectFeature): void;
  removeFeature(featureId: string): void;
  setFeatureVisibility(featureId: string, visible: boolean): void;
  setLabelsVisible(visible: boolean): void;
  setFeatureEditable(featureId: string, enabled: boolean): void;
  toggleFeatureEditable(featureId: string): void;
  setPreviewExtrusions(extrusions: Readonly<Record<FeatureId, number>>): void;
  selectFeature(featureId: string | null): void;
  fitFeature(featureId: string): void;
  setBasemap(basemapId: string): boolean;
  getBasemapId(): string;
  getBasemapOptions(): readonly BasemapOption[];
  onMapClick(listener: (coordinate: Coordinate) => void): () => void;
  onMapViewChanged(listener: (view: MapView) => void): () => void;
  onFeatureSelect(listener: (featureId: FeatureId | null) => void): () => void;
  onContextRequest(listener: (request: MapContextRequest) => void): () => void;
  cancelActiveInteractions(): void;
  showSearchResult(preview: GeocodingPreview, onAdd: () => void): void;
  clearSearchResult(): void;
  destroy(): void;
}
