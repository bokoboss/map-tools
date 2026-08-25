import { clone } from '../domain/project';
import type { MapView, ProjectDocumentV2, ProjectFeature } from '../domain/model';
import { normalizeProject } from '../persistence/projectSchema';

export type ProjectStoreChange = 'mutation' | 'replace';
export type ProjectStoreListener = (snapshot: ProjectDocumentV2, change: ProjectStoreChange) => void;

export class ProjectStore {
  private project: ProjectDocumentV2;
  private dirty = false;
  private readonly listeners = new Set<ProjectStoreListener>();

  constructor(initial: ProjectDocumentV2) {
    this.project = normalizeProject(initial);
  }

  getSnapshot(): ProjectDocumentV2 {
    return clone(this.project);
  }

  isDirty(): boolean {
    return this.dirty;
  }

  subscribe(listener: ProjectStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replaceProject(candidate: ProjectDocumentV2): void {
    this.project = normalizeProject(candidate);
    this.dirty = false;
    this.emit('replace');
  }

  mutate(mutator: (draft: ProjectDocumentV2) => void): void {
    const draft = this.getSnapshot();
    mutator(draft);
    draft.project.updatedAt = new Date().toISOString();
    this.project = normalizeProject(draft);
    this.dirty = true;
    this.emit('mutation');
  }

  addFeature(feature: ProjectFeature): void {
    this.mutate((draft) => draft.features.push(clone(feature)));
  }

  updateFeature(feature: ProjectFeature): void {
    this.mutate((draft) => {
      const index = draft.features.findIndex((item) => item.id === feature.id);
      if (index < 0) throw new Error(`Feature not found: ${feature.id}`);
      draft.features[index] = clone(feature);
    });
  }

  removeFeature(featureId: string): void {
    this.mutate((draft) => {
      draft.features = draft.features.filter((feature) => feature.id !== featureId);
    });
  }

  setMapView(mapView: MapView): void {
    this.mutate((draft) => {
      draft.mapView = clone(mapView);
    });
  }

  markSaved(): void {
    this.dirty = false;
  }

  private emit(change: ProjectStoreChange): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot, change));
  }
}
