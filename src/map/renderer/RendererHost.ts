import type { Coordinate, FeatureId, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';
import type { BasemapOption, GeocodingPreview, MapContextRequest, MapRenderer } from './MapRenderer';

export class RendererHost implements MapRenderer {
  private current: MapRenderer;
  private readonly mapClickListeners = new Set<(coordinate: Coordinate) => void>();
  private readonly mapViewListeners = new Set<(view: MapView) => void>();
  private readonly featureSelectListeners = new Set<(featureId: FeatureId | null) => void>();
  private readonly contextRequestListeners = new Set<(request: MapContextRequest) => void>();
  private mapClickUnsubscribers = new Map<(coordinate: Coordinate) => void, () => void>();
  private mapViewUnsubscribers = new Map<(view: MapView) => void, () => void>();
  private featureSelectUnsubscribers = new Map<(featureId: FeatureId | null) => void, () => void>();
  private contextRequestUnsubscribers = new Map<(request: MapContextRequest) => void, () => void>();
  private selectedFeatureId: FeatureId | null = null;

  constructor(renderer: MapRenderer) {
    this.current = renderer;
  }

  replace(renderer: MapRenderer, project: ProjectDocumentV2): void {
    this.replaceInternal(() => renderer, project);
  }

  replaceWith(factory: () => MapRenderer, project: ProjectDocumentV2): MapRenderer {
    return this.replaceInternal(factory, project);
  }

  getCurrentRenderer(): MapRenderer { return this.current; }
  getCapabilities() { return this.current.getCapabilities(); }
  getCameraPresentation() { return this.current.getCameraPresentation(); }
  setCameraPresentation(presentation: Parameters<MapRenderer['setCameraPresentation']>[0]): void { this.current.setCameraPresentation(presentation); }
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
  setPreviewExtrusions(extrusions: Readonly<Record<FeatureId, number>>): void { this.current.setPreviewExtrusions(extrusions); }
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
  onMapViewChanged(listener: (view: MapView) => void): () => void {
    this.mapViewListeners.add(listener);
    this.mapViewUnsubscribers.set(listener, this.current.onMapViewChanged(listener));
    return () => {
      this.mapViewUnsubscribers.get(listener)?.();
      this.mapViewUnsubscribers.delete(listener);
      this.mapViewListeners.delete(listener);
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
  cancelActiveInteractions(): void { this.current.cancelActiveInteractions(); }
  destroy(): void {
    this.detachListeners();
    this.current.destroy();
  }

  private attachListeners(): void {
    this.mapClickListeners.forEach((listener) => this.mapClickUnsubscribers.set(listener, this.current.onMapClick(listener)));
    this.mapViewListeners.forEach((listener) => this.mapViewUnsubscribers.set(listener, this.current.onMapViewChanged(listener)));
    this.featureSelectListeners.forEach((listener) => this.featureSelectUnsubscribers.set(listener, this.current.onFeatureSelect(listener)));
    this.contextRequestListeners.forEach((listener) => this.contextRequestUnsubscribers.set(listener, this.current.onContextRequest(listener)));
  }

  private detachListeners(): void {
    this.mapClickUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.mapViewUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.featureSelectUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.contextRequestUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.mapClickUnsubscribers.clear();
    this.mapViewUnsubscribers.clear();
    this.featureSelectUnsubscribers.clear();
    this.contextRequestUnsubscribers.clear();
  }

  private replaceInternal(factory: () => MapRenderer, project: ProjectDocumentV2): MapRenderer {
    const previous = this.current;
    // Construct and render the candidate while the current renderer is still alive.
    // A constructor/style failure therefore leaves the current workspace usable.
    const next = factory();
    try {
      this.detachListeners();
      this.current = next;
      this.attachListeners();
      next.renderProject(project);
      next.selectFeature(this.selectedFeatureId);
    } catch (error) {
      this.detachListeners();
      try { next.destroy(); } catch { /* best-effort cleanup of a failed candidate */ }
      this.current = previous;
      this.attachListeners();
      throw error;
    }
    previous.destroy();
    return next;
  }
}
