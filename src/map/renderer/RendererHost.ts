import type { Coordinate, MapView, ProjectDocumentV2, ProjectFeature } from '../../domain/model';
import type { BasemapOption, GeocodingPreview, MapRenderer } from './MapRenderer';

export class RendererHost implements MapRenderer {
  private current: MapRenderer;

  constructor(renderer: MapRenderer) {
    this.current = renderer;
  }

  replace(renderer: MapRenderer, project: ProjectDocumentV2): void {
    const previous = this.current;
    this.current = renderer;
    previous.destroy();
    this.current.renderProject(project);
  }

  replaceWith(factory: () => MapRenderer, project: ProjectDocumentV2): MapRenderer {
    this.current.destroy();
    this.current = factory();
    this.current.renderProject(project);
    return this.current;
  }

  setView(view: MapView): void { this.current.setView(view); }
  getView(): MapView { return this.current.getView(); }
  renderProject(project: ProjectDocumentV2): void { this.current.renderProject(project); }
  upsertFeature(feature: ProjectFeature): void { this.current.upsertFeature(feature); }
  removeFeature(featureId: string): void { this.current.removeFeature(featureId); }
  setFeatureVisibility(featureId: string, visible: boolean): void { this.current.setFeatureVisibility(featureId, visible); }
  setLabelsVisible(visible: boolean): void { this.current.setLabelsVisible(visible); }
  setFeatureEditable(featureId: string, enabled: boolean): void { this.current.setFeatureEditable(featureId, enabled); }
  toggleFeatureEditable(featureId: string): void { this.current.toggleFeatureEditable(featureId); }
  selectFeature(featureId: string | null): void { this.current.selectFeature(featureId); }
  fitFeature(featureId: string): void { this.current.fitFeature(featureId); }
  setBasemap(basemapId: string): boolean { return this.current.setBasemap(basemapId); }
  getBasemapId(): string { return this.current.getBasemapId(); }
  getBasemapOptions(): readonly BasemapOption[] { return this.current.getBasemapOptions(); }
  onMapClick(listener: (coordinate: Coordinate) => void): () => void { return this.current.onMapClick(listener); }
  showSearchResult(preview: GeocodingPreview, onAdd: () => void): void { this.current.showSearchResult(preview, onAdd); }
  clearSearchResult(): void { this.current.clearSearchResult(); }
  destroy(): void { this.current.destroy(); }
}
