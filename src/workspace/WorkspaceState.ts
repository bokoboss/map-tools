import type { FeatureId, GroupId } from '../domain/model';

export interface WorkspaceStateSnapshot {
  selectedFeatureId: FeatureId | null;
  expandedGroupIds: GroupId[];
}

export type WorkspaceStateListener = (snapshot: WorkspaceStateSnapshot) => void;

/**
 * Transient, renderer-neutral workspace state.
 *
 * Only stable domain IDs cross this boundary. The project document remains
 * the source of truth for persisted features and groups.
 */
export class WorkspaceState {
  private selectedFeatureId: FeatureId | null = null;
  private readonly expandedGroupIds = new Set<GroupId>();
  private readonly listeners = new Set<WorkspaceStateListener>();

  getSnapshot(): WorkspaceStateSnapshot {
    return {
      selectedFeatureId: this.selectedFeatureId,
      expandedGroupIds: [...this.expandedGroupIds]
    };
  }

  getSelectedFeatureId(): FeatureId | null {
    return this.selectedFeatureId;
  }

  isGroupExpanded(groupId: GroupId): boolean {
    return this.expandedGroupIds.has(groupId);
  }

  subscribe(listener: WorkspaceStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  selectFeature(featureId: FeatureId | null): void {
    if (this.selectedFeatureId === featureId) return;
    this.selectedFeatureId = featureId;
    this.emit();
  }

  clearSelection(): void {
    this.selectFeature(null);
  }

  toggleGroup(groupId: GroupId): void {
    if (this.expandedGroupIds.has(groupId)) this.expandedGroupIds.delete(groupId);
    else this.expandedGroupIds.add(groupId);
    this.emit();
  }

  setGroupExpanded(groupId: GroupId, expanded: boolean): void {
    if (expanded) this.expandedGroupIds.add(groupId);
    else this.expandedGroupIds.delete(groupId);
    this.emit();
  }

  retainFeature(featureId: FeatureId | null, validFeatureIds: ReadonlySet<FeatureId>): void {
    if (featureId && validFeatureIds.has(featureId)) return;
    this.clearSelection();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
