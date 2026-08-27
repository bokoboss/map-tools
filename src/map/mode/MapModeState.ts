import type { CameraPresentation, RendererMode } from '../renderer/MapRenderer';
import type { FeatureId } from '../../domain/model';

export const DEFAULT_3D_CAMERA: CameraPresentation = { pitchDeg: 55, bearingDeg: -20 };

export interface MapModeSnapshot {
  mode: RendererMode;
  camera3d: CameraPresentation;
  previewExtrusions: Record<FeatureId, number>;
}

export type MapModeStateListener = (snapshot: MapModeSnapshot) => void;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export class MapModeState {
  private mode: RendererMode = '2d';
  private camera3d: CameraPresentation = { ...DEFAULT_3D_CAMERA };
  private readonly previewExtrusions = new Map<FeatureId, number>();
  private readonly listeners = new Set<MapModeStateListener>();

  getSnapshot(): MapModeSnapshot {
    return {
      mode: this.mode,
      camera3d: { ...this.camera3d },
      previewExtrusions: Object.fromEntries(this.previewExtrusions)
    };
  }

  subscribe(listener: MapModeStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMode(mode: RendererMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.emit();
  }

  setCameraPresentation(presentation: CameraPresentation): void {
    const next = {
      pitchDeg: Math.min(60, Math.max(0, finiteOr(presentation.pitchDeg, DEFAULT_3D_CAMERA.pitchDeg))),
      bearingDeg: finiteOr(presentation.bearingDeg, DEFAULT_3D_CAMERA.bearingDeg)
    };
    if (next.pitchDeg === this.camera3d.pitchDeg && next.bearingDeg === this.camera3d.bearingDeg) return;
    this.camera3d = next;
    this.emit();
  }

  setPreviewExtrusion(featureId: FeatureId, heightM: number | null): void {
    if (heightM === null || !Number.isFinite(heightM) || heightM <= 0) {
      if (!this.previewExtrusions.delete(featureId)) return;
    } else {
      if (this.previewExtrusions.get(featureId) === heightM) return;
      this.previewExtrusions.set(featureId, heightM);
    }
    this.emit();
  }

  retainPreviewExtrusions(validFeatureIds: ReadonlySet<FeatureId>): void {
    let changed = false;
    for (const featureId of this.previewExtrusions.keys()) {
      if (!validFeatureIds.has(featureId)) {
        this.previewExtrusions.delete(featureId);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  clearPreviewExtrusions(): void {
    if (!this.previewExtrusions.size) return;
    this.previewExtrusions.clear();
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
