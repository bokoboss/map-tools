import type { Coordinate, FeatureStyle, ProjectFeatureType } from '../domain/model';

export type DrawTool = 'polyline' | 'polygon' | 'circle' | 'rectangle' | 'arrow';

export interface DrawnFeatureDraft {
  type: Exclude<ProjectFeatureType, 'marker' | 'text'>;
  name: string;
  geometry: {
    kind: 'lineString';
    coordinates: Coordinate[];
  } | {
    kind: 'polygon';
    coordinates: Coordinate[];
  } | {
    kind: 'bounds';
    southWest: Coordinate;
    northEast: Coordinate;
  } | {
    kind: 'circle';
    center: Coordinate;
    radiusM: number;
  };
  style: FeatureStyle;
};

export interface DrawingAdapter {
  start(tool: DrawTool): void;
  cancel(): void;
  onCreated(listener: (draft: DrawnFeatureDraft) => void): () => void;
  destroy(): void;
}
