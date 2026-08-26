import { clone } from '../domain/project';
import { canMutateFeature } from '../domain/mutationPolicy';
import type { MapView, ProjectDocumentV2, ProjectFeature } from '../domain/model';
import { normalizeProject } from '../persistence/projectSchema';
import { ProjectHistory, projectFingerprint } from './ProjectHistory';
import type { ProjectHistoryState } from './ProjectHistory';

export type ProjectStoreChange = 'mutation' | 'replace' | 'history' | 'baseline';
export type ProjectStoreListener = (snapshot: ProjectDocumentV2, change: ProjectStoreChange) => void;

export interface ProjectStoreMutationOptions {
  recordHistory?: boolean;
}

interface ActiveTransaction {
  before: ProjectDocumentV2;
  label: string;
}

export class ProjectStore {
  private project: ProjectDocumentV2;
  private savedBaseline: string;
  private readonly history: ProjectHistory;
  private activeTransaction: ActiveTransaction | null = null;
  private readonly listeners = new Set<ProjectStoreListener>();

  constructor(initial: ProjectDocumentV2, maximumHistoryEntries = 100) {
    this.project = normalizeProject(initial);
    this.savedBaseline = projectFingerprint(this.project);
    this.history = new ProjectHistory(maximumHistoryEntries);
  }

  getSnapshot(): ProjectDocumentV2 {
    return clone(this.project);
  }

  isDirty(): boolean {
    return projectFingerprint(this.project) !== this.savedBaseline;
  }

  getHistoryState(): ProjectHistoryState {
    return this.history.getState();
  }

  subscribe(listener: ProjectStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replaceProject(candidate: ProjectDocumentV2): void {
    this.activeTransaction = null;
    this.project = normalizeProject(candidate);
    this.savedBaseline = projectFingerprint(this.project);
    this.history.clear();
    this.emit('replace');
  }

  mutate(mutator: (draft: ProjectDocumentV2) => void, label = 'Edit project', options: ProjectStoreMutationOptions = {}): void {
    const before = this.getSnapshot();
    const draft = clone(before);
    mutator(draft);
    draft.project.updatedAt = new Date().toISOString();
    const next = normalizeProject(draft);
    if (projectFingerprint(before) === projectFingerprint(next)) return;
    this.project = next;
    if (!this.activeTransaction && options.recordHistory !== false) this.history.commit(before, next, label);
    this.emit('mutation');
  }

  beginTransaction(label = 'Edit project'): void {
    if (this.activeTransaction) return;
    this.activeTransaction = { before: this.getSnapshot(), label };
  }

  endTransaction(): void {
    const transaction = this.activeTransaction;
    if (!transaction) return;
    this.activeTransaction = null;
    this.history.commit(transaction.before, this.project, transaction.label);
  }

  cancelTransaction(): void {
    const transaction = this.activeTransaction;
    if (!transaction) return;
    this.activeTransaction = null;
    this.project = normalizeProject(transaction.before);
    this.emit('history');
  }

  undo(): boolean {
    this.activeTransaction = null;
    const previous = this.history.undo();
    if (!previous) return false;
    this.project = normalizeProject(previous);
    this.emit('history');
    return true;
  }

  redo(): boolean {
    this.activeTransaction = null;
    const next = this.history.redo();
    if (!next) return false;
    this.project = normalizeProject(next);
    this.emit('history');
    return true;
  }

  addFeature(feature: ProjectFeature, label = 'Create feature'): void {
    this.mutate((draft) => draft.features.push(clone(feature)), label);
  }

  updateFeature(feature: ProjectFeature, label = 'Update feature', mutationKind: Parameters<typeof canMutateFeature>[2] = 'property'): boolean {
    if (!canMutateFeature(this.project, feature.id, mutationKind)) return false;
    this.mutate((draft) => {
      const index = draft.features.findIndex((item) => item.id === feature.id);
      if (index < 0) throw new Error(`Feature not found: ${feature.id}`);
      draft.features[index] = clone(feature);
    }, label);
    return true;
  }

  removeFeature(featureId: string, label = 'Delete feature'): boolean {
    if (!canMutateFeature(this.project, featureId, 'delete')) return false;
    this.mutate((draft) => {
      draft.features = draft.features.filter((feature) => feature.id !== featureId);
    }, label);
    return true;
  }

  setMapView(mapView: MapView, label = 'Update map view', options: ProjectStoreMutationOptions = { recordHistory: false }): void {
    this.mutate((draft) => {
      draft.mapView = clone(mapView);
    }, label, options);
  }

  markSaved(): void {
    this.savedBaseline = projectFingerprint(this.project);
    this.emit('baseline');
  }

  private emit(change: ProjectStoreChange): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot, change));
  }
}
