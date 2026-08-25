export const SCHEMA_VERSION = 2 as const;

export type ProjectId = string;
export type GroupId = string;
export type FeatureId = string;
export type RadiusId = string;

/** Canonical WGS84 coordinate order: [longitude, latitude]. */
export type Coordinate = readonly [longitude: number, latitude: number];

export type HexColor = string;

export interface AppMetadata {
  name: string;
  version: string;
}

export interface ProjectMetadata {
  id: ProjectId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapView {
  center: Coordinate;
  zoom: number;
  basemapId: string;
}

export interface ProjectGroup {
  id: GroupId;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface PointGeometry {
  kind: 'point';
  coordinates: Coordinate;
}

export interface LineStringGeometry {
  kind: 'lineString';
  coordinates: Coordinate[];
}

export interface PolygonGeometry {
  kind: 'polygon';
  coordinates: Coordinate[];
}

export interface BoundsGeometry {
  kind: 'bounds';
  southWest: Coordinate;
  northEast: Coordinate;
}

export interface CircleGeometry {
  kind: 'circle';
  center: Coordinate;
  radiusM: number;
}

export interface FeatureStyle {
  color?: HexColor;
  fillColor?: HexColor;
  weightPx?: number;
  opacity?: number;
  fillOpacity?: number;
  dashArray?: string | null;
  rotationDeg?: number;
  fontSizePx?: number;
  fontWeight?: number;
  halo?: boolean;
  symbolId?: string;
  arrowHead?: 'end';
}

export interface RadiusRing {
  id: RadiusId;
  distanceM: number;
  color: HexColor;
  fillOpacity: number;
}

export interface MarkerProperties {
  radii: RadiusRing[];
}

export interface TextProperties {
  text: string;
}

export interface FeatureBase<Type extends ProjectFeatureType, Geometry, Properties> {
  id: FeatureId;
  type: Type;
  name: string;
  groupId: GroupId | null;
  visible: boolean;
  locked: boolean;
  geometry: Geometry;
  style: FeatureStyle;
  properties: Properties;
}

export type MarkerFeature = FeatureBase<'marker', PointGeometry, MarkerProperties>;
export type TextFeature = FeatureBase<'text', PointGeometry, TextProperties>;
export type PolylineFeature = FeatureBase<'polyline', LineStringGeometry, Record<string, never>>;
export type PolygonFeature = FeatureBase<'polygon', PolygonGeometry, Record<string, never>>;
export type RectangleFeature = FeatureBase<'rectangle', BoundsGeometry, Record<string, never>>;
export type CircleFeature = FeatureBase<'circle', CircleGeometry, Record<string, never>>;
export type ArrowFeature = FeatureBase<'arrow', LineStringGeometry, Record<string, never>>;

export type ProjectFeature =
  | MarkerFeature
  | TextFeature
  | PolylineFeature
  | PolygonFeature
  | RectangleFeature
  | CircleFeature
  | ArrowFeature;

export type ProjectFeatureType = ProjectFeature['type'];

export interface ProjectDocumentV2 {
  schemaVersion: typeof SCHEMA_VERSION;
  app: AppMetadata;
  project: ProjectMetadata;
  mapView: MapView;
  groups: ProjectGroup[];
  features: ProjectFeature[];
}

export type ProjectDocument = ProjectDocumentV2;
