import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyProject } from '../src/domain/project';
import { serializeProject } from '../src/persistence/projectSchema';
import { WorkspaceState } from '../src/workspace/WorkspaceState';

test('workspace selection is stable-ID transient state and never part of project serialization', () => {
  const project = createEmptyProject({ projectId: 'workspace-project' });
  const workspace = new WorkspaceState();
  workspace.selectFeature('feature-1');
  workspace.setGroupExpanded('group-1', true);

  const serialized = serializeProject(project);
  assert.equal(workspace.getSelectedFeatureId(), 'feature-1');
  assert.deepEqual(workspace.getSnapshot().expandedGroupIds, ['group-1']);
  assert.equal(serialized.includes('selectedFeatureId'), false);
  assert.equal(serialized.includes('expandedGroupIds'), false);
});

test('workspace clears a selection when the stable feature ID is no longer valid', () => {
  const workspace = new WorkspaceState();
  workspace.selectFeature('feature-1');
  workspace.retainFeature('feature-1', new Set(['feature-2']));
  assert.equal(workspace.getSelectedFeatureId(), null);
});

