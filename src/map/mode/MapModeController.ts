import { DisabledDrawingAdapter } from '../../drawing/DisabledDrawingAdapter';
import type { DrawingAdapter } from '../../drawing/DrawingAdapter';
import { clone } from '../../domain/project';
import type { CameraPresentation, MapRenderer, RendererCapabilities, RendererMode } from '../renderer/MapRenderer';
import type { FeatureId } from '../../domain/model';
import { RendererHost } from '../renderer/RendererHost';
import { ProjectStore } from '../../store/ProjectStore';
import { MapModeState, type MapModeSnapshot } from './MapModeState';

export interface RendererBundle {
  renderer: MapRenderer;
  drawing: DrawingAdapter;
}

export interface MapModeControllerOptions {
  host: RendererHost;
  store: ProjectStore;
  state?: MapModeState;
  create2d: () => RendererBundle;
  create3d: () => RendererBundle;
  prepareForSwitch: () => void;
  setDrawingAdapter: (drawing: DrawingAdapter) => void;
  setActiveSurface: (mode: RendererMode) => void;
  onCapabilitiesChanged: (capabilities: RendererCapabilities) => void;
  onError: (message: string) => void;
}

function viewChanged(left: ReturnType<MapRenderer['getView']>, right: ReturnType<MapRenderer['getView']>): boolean {
  return left.center[0] !== right.center[0] || left.center[1] !== right.center[1] || left.zoom !== right.zoom;
}

/** Coordinates renderer replacement while keeping all project state in ProjectStore. */
export class MapModeController {
  readonly state: MapModeState;
  private readonly options: MapModeControllerOptions;
  private readonly unsubscribeState: () => void;
  private readonly unsubscribeStore: () => void;

  constructor(options: MapModeControllerOptions) {
    this.options = options;
    this.state = options.state ?? new MapModeState();
    this.unsubscribeState = this.state.subscribe((snapshot) => {
      this.options.host.setPreviewExtrusions(snapshot.previewExtrusions);
    });
    this.unsubscribeStore = this.options.store.subscribe((snapshot, change) => {
      if (change === 'replace') this.state.clearPreviewExtrusions();
      const validPreviewIds = new Set(snapshot.features
        .filter((feature) => feature.type === 'polygon' || feature.type === 'rectangle')
        .map((feature) => feature.id));
      this.state.retainPreviewExtrusions(validPreviewIds);
      this.options.host.setPreviewExtrusions(this.state.getSnapshot().previewExtrusions);
    });
    this.options.onCapabilitiesChanged(this.options.host.getCapabilities());
  }

  getSnapshot(): MapModeSnapshot {
    return this.state.getSnapshot();
  }

  getPreviewHeight(featureId: FeatureId): number | null {
    return this.state.getSnapshot().previewExtrusions[featureId] ?? null;
  }

  switchTo(mode: RendererMode): boolean {
    const currentMode = this.state.getSnapshot().mode;
    if (currentMode === mode) return true;

    this.options.prepareForSwitch();
    this.captureSharedView();
    if (currentMode === '3d-preview') this.state.setCameraPresentation(this.options.host.getCameraPresentation());

    const project = this.options.store.getSnapshot();
    this.state.retainPreviewExtrusions(new Set(project.features
      .filter((feature) => feature.type === 'polygon' || feature.type === 'rectangle')
      .map((feature) => feature.id)));

    let bundle: RendererBundle | null = null;
    try {
      this.options.host.replaceWith(() => {
        bundle = mode === '3d-preview' ? this.options.create3d() : this.options.create2d();
        return bundle.renderer;
      }, clone(project));
      const nextBundle = bundle as RendererBundle | null;
      if (!nextBundle) throw new Error('Renderer factory returned no bundle');
      this.options.host.setView(project.mapView);
      if (mode === '3d-preview') this.options.host.setCameraPresentation(this.state.getSnapshot().camera3d);
      else this.options.host.setCameraPresentation({ pitchDeg: 0, bearingDeg: 0 });
      this.options.setDrawingAdapter(nextBundle.drawing);
      this.state.setMode(mode);
      this.options.setActiveSurface(mode);
      this.options.onCapabilitiesChanged(this.options.host.getCapabilities());
      return true;
    } catch (error) {
      const failedBundle = bundle as RendererBundle | null;
      failedBundle?.drawing.destroy();
      this.options.setActiveSurface(currentMode);
      this.options.onCapabilitiesChanged(this.options.host.getCapabilities());
      const message = error instanceof Error ? error.message : String(error);
      this.options.onError(`3D Preview is unavailable. Your project is safe; you can continue in 2D. (${message})`);
      return false;
    }
  }

  handlePreviewFailure(error: unknown): void {
    if (this.state.getSnapshot().mode !== '3d-preview') return;
    const message = error instanceof Error ? error.message : String(error);
    this.options.onError(`3D Preview could not load. Your project is safe; returning to 2D. (${message})`);
    this.switchTo('2d');
  }

  resetNorth(): void {
    if (this.state.getSnapshot().mode !== '3d-preview') return;
    const next: CameraPresentation = { ...this.options.host.getCameraPresentation(), bearingDeg: 0 };
    this.state.setCameraPresentation(next);
    this.options.host.setCameraPresentation(next);
  }

  topView(): void {
    if (this.state.getSnapshot().mode !== '3d-preview') return;
    const next: CameraPresentation = { ...this.options.host.getCameraPresentation(), pitchDeg: 0 };
    this.state.setCameraPresentation(next);
    this.options.host.setCameraPresentation(next);
  }

  setPreviewExtrusion(featureId: FeatureId, enabled: boolean, heightM = 20): void {
    if (this.state.getSnapshot().mode !== '3d-preview') return;
    const feature = this.options.store.getSnapshot().features.find((candidate) => candidate.id === featureId);
    if (!feature || (feature.type !== 'polygon' && feature.type !== 'rectangle')) return;
    this.state.setPreviewExtrusion(featureId, enabled ? heightM : null);
    this.options.host.setPreviewExtrusions(this.state.getSnapshot().previewExtrusions);
  }

  setPreviewHeight(featureId: FeatureId, heightM: number): void {
    if (this.state.getSnapshot().mode !== '3d-preview') return;
    const feature = this.options.store.getSnapshot().features.find((candidate) => candidate.id === featureId);
    if (!feature || (feature.type !== 'polygon' && feature.type !== 'rectangle')) return;
    if (!this.state.getSnapshot().previewExtrusions[featureId]) return;
    this.state.setPreviewExtrusion(featureId, heightM);
    this.options.host.setPreviewExtrusions(this.state.getSnapshot().previewExtrusions);
  }

  destroy(): void {
    this.unsubscribeState();
    this.unsubscribeStore();
  }

  private captureSharedView(): void {
    const rendererView = this.options.host.getView();
    const projectView = this.options.store.getSnapshot().mapView;
    if (!viewChanged(rendererView, projectView)) return;
    this.options.store.setMapView({
      center: rendererView.center,
      zoom: rendererView.zoom,
      basemapId: projectView.basemapId
    }, 'Update map view', { recordHistory: false });
  }
}

export { DisabledDrawingAdapter };
