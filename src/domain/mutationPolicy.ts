import type { FeatureId, ProjectDocumentV2, ProjectFeature } from './model';
import { effectiveState } from './project';

/** Mutations that may be attempted against a project feature. */
export type FeatureMutationKind =
  | 'geometry'
  | 'move'
  | 'name'
  | 'content'
  | 'style'
  | 'radius'
  | 'group'
  | 'delete'
  | 'duplicate'
  | 'visibility'
  | 'lock'
  | 'property';

export function featureForId(project: ProjectDocumentV2, featureId: FeatureId): ProjectFeature | null {
  return project.features.find((feature) => feature.id === featureId) ?? null;
}

export function featureIsEffectivelyLocked(project: ProjectDocumentV2, featureId: FeatureId): boolean {
  const feature = featureForId(project, featureId);
  if (!feature) return false;
  const group = feature.groupId ? project.groups.find((candidate) => candidate.id === feature.groupId) : null;
  return effectiveState(feature, group).locked;
}

/**
 * Central lock policy for feature mutations. Selection, inspection, zoom, and
 * other transient UI operations are intentionally outside this policy.
 */
export function canMutateFeature(project: ProjectDocumentV2, featureId: FeatureId, mutationKind: FeatureMutationKind): boolean {
  if (!featureForId(project, featureId)) return false;
  if (!featureIsEffectivelyLocked(project, featureId)) return true;
  return mutationKind === 'visibility' || mutationKind === 'lock';
}

export type GroupMutationKind = 'visibility' | 'lock' | 'rename' | 'delete' | 'assignment';

/** Group visibility/lock changes and explicit group ungrouping are group-level commands. */
export function canMutateGroup(project: ProjectDocumentV2, groupId: string, mutationKind: GroupMutationKind): boolean {
  const group = project.groups.find((candidate) => candidate.id === groupId);
  if (!group) return false;
  if (mutationKind === 'visibility' || mutationKind === 'lock') return true;
  if (mutationKind === 'delete') return true;
  if (group.locked) return false;
  if (mutationKind === 'rename') return true;
  return project.features
    .filter((feature) => feature.groupId === groupId)
    .every((feature) => canMutateFeature(project, feature.id, 'group'));
}
