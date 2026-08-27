import type { Coordinate, FeatureId, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';
import type { BasemapOption, GeocodingPreview, MapContextRequest, MapRenderer } from './MapRenderer';

export class RendererHost implements MapRenderer {
  private current: MapRenderer;
  private readonly mapClickListeners = new Set<(coordinate: Coordinate) => void>();
  private readonly featureSelectListeners = new Set<(featureId: FeatureId | null) => void>();
  private readonly contextRequestListeners = new Set<(request: MapContextRequest) => void>();
  private mapClickUnsubscribers = new Map<(coordinate: Coordinate) => void, () => void>();
  private featureSelectUnsubscribers = new Map<(featureId: FeatureId | null) => void, () => void>();
  private contextRequestUnsubscribers = new Map<(request: MapContextRequest) => void, () => void>();
  private selectedFeatureId: FeatureId | null = null;

  constructor(renderer: MapRenderer) {
    this.current = renderer;
  }

  replace(renderer: MapRenderer, project: ProjectDocumentV2): void {
    const previous = this.current;
    this.detachListeners();
    this.current = renderer;
    previous.destroy();
    this.attachListeners();
    this.current.renderProject(project);
    this.current.selectFeature(this.selectedFeatureId);
  }

  replaceWith(factory: () => MapRenderer, project: ProjectDocumentV2): MapRenderer {
    this.detachListeners();
    this.current.destroy();
    this.current = factory();
    this.attachListeners();
    this.current.renderProject(project);
    this.current.selectFeature(this.selectedFeatureId);
    return this.current;
  }

  setView(view: MapView): void { this.current.setView(view); }
  getView(): MapView { return this.current.getView(); }
  renderProject(project: ProjectDocumentV2): void {
    if (this.selectedFeatureId && !project.features.some((feature) => feature.id === this.selectedFeatureId)) this.selectedFeatureId = null;
    this.current.renderProject(project);
    this.current.selectFeature(this.selectedFeatureId);
  }
  upsertFeature(feature: ProjectFeature): void { this.current.upsertFeature(feature); }
  removeFeature(featureId: string): void { this.current.removeFeature(featureId); }
  setFeatureVisibility(featureId: string, visible: boolean): void { this.current.setFeatureVisibility(featureId, visible); }
  setLabelsVisible(visible: boolean): void { this.current.setLabelsVisible(visible); }
  setFeatureEditable(featureId: string, enabled: boolean): void { this.current.setFeatureEditable(featureId, enabled); }
  toggleFeatureEditable(featureId: string): void { this.current.toggleFeatureEditable(featureId); }
  selectFeature(featureId: string | null): void {
    this.selectedFeatureId = featureId;
    this.current.selectFeature(featureId);
  }
  fitFeature(featureId: string): void { this.current.fitFeature(featureId); }
  setBasemap(basemapId: string): boolean { return this.current.setBasemap(basemapId); }
  getBasemapId(): string { return this.current.getBasemapId(); }
  getBasemapOptions(): readonly BasemapOption[] { return this.current.getBasemapOptions(); }
  onMapClick(listener: (coordinate: Coordinate) => void): () => void {
    this.mapClickListeners.add(listener);
    this.mapClickUnsubscribers.set(listener, this.current.onMapClick(listener));
    return () => {
      this.mapClickUnsubscribers.get(listener)?.();
      this.mapClickUnsubscribers.delete(listener);
      this.mapClickListeners.delete(listener);
    };
  }
  onFeatureSelect(listener: (featureId: FeatureId | null) => void): () => void {
    this.featureSelectListeners.add(listener);
    this.featureSelectUnsubscribers.set(listener, this.current.onFeatureSelect(listener));
    return () => {
      this.featureSelectUnsubscribers.get(listener)?.();
      this.featureSelectUnsubscribers.delete(listener);
      this.featureSelectListeners.delete(listener);
    };
  }
  onContextRequest(listener: (request: MapContextRequest) => void): () => void {
    this.contextRequestListeners.add(listener);
    this.contextRequestUnsubscribers.set(listener, this.current.onContextRequest(listener));
    return () => {
      this.contextRequestUnsubscribers.get(listener)?.();
      this.contextRequestUnsubscribers.delete(listener);
      this.contextRequestListeners.delete(listener);
    };
  }
  showSearchResult(preview: GeocodingPreview, onAdd: () => void): void { this.current.showSearchResult(preview, onAdd); }
  clearSearchResult(): void { this.current.clearSearchResult(); }
  destroy(): void {
    this.detachListeners();
    this.current.destroy();
  }

  private attachListeners(): void {
    this.mapClickListeners.forEach((listener) => this.mapClickUnsubscribers.set(listener, this.current.onMapClick(listener)));
    this.featureSelectListeners.forEach((listener) => this.featureSelectUnsubscribers.set(listener, this.current.onFeatureSelect(listener)));
    this.contextRequestListeners.forEach((listener) => this.contextRequestUnsubscribers.set(listener, this.current.onContextRequest(listener)));
  }

  private detachListeners(): void {
    this.mapClickUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.featureSelectUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.contextRequestUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.mapClickUnsubscribers.clear();
    this.featureSelectUnsubscribers.clear();
    this.contextRequestUnsubscribers.clear();
  }
}
