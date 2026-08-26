import { clone } from '../domain/project';
import type { ProjectDocumentV2 } from '../domain/model';

export interface ProjectHistoryEntry {
  label: string;
  before: ProjectDocumentV2;
  after: ProjectDocumentV2;
}

export interface ProjectHistoryState {
  length: number;
  position: number;
  canUndo: boolean;
  canRedo: boolean;
}

/** A bounded, domain-only before/after snapshot history. */
export class ProjectHistory {
  private readonly entries: ProjectHistoryEntry[] = [];
  private position = 0;

  constructor(private readonly maximumEntries = 100) {}

  commit(before: ProjectDocumentV2, after: ProjectDocumentV2, label: string): boolean {
    if (projectFingerprint(before) === projectFingerprint(after)) return false;
    if (this.position < this.entries.length) this.entries.splice(this.position);
    this.entries.push({ label, before: clone(before), after: clone(after) });
    this.position = this.entries.length;
    while (this.entries.length > this.maximumEntries) {
      this.entries.shift();
      this.position -= 1;
    }
    return true;
  }

  undo(): ProjectDocumentV2 | null {
    if (!this.canUndo()) return null;
    this.position -= 1;
    return clone(this.entries[this.position].before);
  }

  redo(): ProjectDocumentV2 | null {
    if (!this.canRedo()) return null;
    const next = clone(this.entries[this.position].after);
    this.position += 1;
    return next;
  }

  clear(): void {
    this.entries.length = 0;
    this.position = 0;
  }

  canUndo(): boolean {
    return this.position > 0;
  }

  canRedo(): boolean {
    return this.position < this.entries.length;
  }

  getState(): ProjectHistoryState {
    return {
      length: this.entries.length,
      position: this.position,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }
}

/** System timestamps are metadata, not an edit identity for dirty/history checks. */
export function projectFingerprint(project: ProjectDocumentV2): string {
  const comparable = clone(project);
  comparable.project.updatedAt = '';
  return JSON.stringify(comparable);
}
