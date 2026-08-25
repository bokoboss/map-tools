import type { Coordinate, MapView, ProjectDocumentV2, ProjectFeature, ProjectGroup } from './model';
import { SCHEMA_VERSION } from './model';

let idCounter = 0;

export function createId(prefix = 'id'): string {
  const runtimeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (runtimeCrypto?.randomUUID) return `${prefix}-${runtimeCrypto.randomUUID()}`;
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface EmptyProjectOptions {
  appVersion?: string;
  projectId?: string;
  name?: string;
  center?: Coordinate;
  zoom?: number;
  basemapId?: string;
}

export function createEmptyProject(options: EmptyProjectOptions = {}): ProjectDocumentV2 {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    app: { name: 'map-tools', version: options.appVersion ?? '2.x' },
    project: {
      id: options.projectId ?? createId('project'),
      name: options.name ?? 'Untitled Map',
      createdAt: now,
      updatedAt: now
    },
    mapView: {
      center: options.center ?? [100.5018, 13.7563],
      zoom: options.zoom ?? 13,
      basemapId: options.basemapId ?? 'osm-standard'
    },
    groups: [],
    features: []
  };
}

export function effectiveState(feature: Pick<ProjectFeature, 'visible' | 'locked'>, group?: Pick<ProjectGroup, 'visible' | 'locked'> | null) {
  return {
    visible: Boolean(feature.visible && (!group || group.visible)),
    locked: Boolean(feature.locked || (group && group.locked))
  };
}

export function normalizeMapView(view: MapView): MapView {
  return {
    center: [Number(view.center[0]), Number(view.center[1])],
    zoom: Number(view.zoom),
    basemapId: view.basemapId
  };
}
