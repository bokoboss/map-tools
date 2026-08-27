import type { DrawTool, DrawnFeatureDraft, DrawingAdapter } from './DrawingAdapter';

/**
 * Explicitly represents a renderer that cannot create or edit geometry.
 * It deliberately has no renderer/runtime dependency.
 */
export class DisabledDrawingAdapter implements DrawingAdapter {
  constructor(readonly reason = 'Switch to 2D to draw or edit geometry.') {}

  start(_tool: DrawTool): void {
    // The application surfaces the reason through renderer capabilities.
  }

  cancel(): void {
    // There is no active drawing transaction to cancel.
  }

  onCreated(_listener: (draft: DrawnFeatureDraft) => void): () => void {
    return () => undefined;
  }

  destroy(): void {
    // Nothing to release.
  }
}
