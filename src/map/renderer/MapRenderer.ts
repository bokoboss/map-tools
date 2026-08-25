import type { Coordinate, FeatureId, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';

export interface BasemapOption {
  id: string;
  label: string;
}

export type FeatureAction = 'edit' | 'edit-style' | 'edit-radius' | 'delete' | 'toggle-edit' | 'rotate';

export interface GeocodingPreview {
  label: string;
  coordinate: Coordinate;
}

export type FeatureChangePhase = 'update' | 'commit';

export interface MapRenderer {
  setView(view: MapView): void;
  getView(): MapView;
  renderProject(project: ProjectDocumentV2): void;
  upsertFeature(feature: ProjectFeature): void;
  removeFeature(featureId: string): void;
  setFeatureVisibility(featureId: string, visible: boolean): void;
  setLabelsVisible(visible: boolean): void;
  setFeatureEditable(featureId: string, enabled: boolean): void;
  toggleFeatureEditable(featureId: string): void;
  selectFeature(featureId: string | null): void;
  fitFeature(featureId: string): void;
  setBasemap(basemapId: string): boolean;
  getBasemapId(): string;
  getBasemapOptions(): readonly BasemapOption[];
  onMapClick(listener: (coordinate: Coordinate) => void): () => void;
  onFeatureSelect(listener: (featureId: FeatureId | null) => void): () => void;
  showSearchResult(preview: GeocodingPreview, onAdd: () => void): void;
  clearSearchResult(): void;
  destroy(): void;
}
