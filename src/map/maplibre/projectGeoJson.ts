import { effectiveState } from '../../domain/project';
import type { Coordinate, FeatureId, FeatureStyle, ProjectDocumentV2, ProjectFeature } from '../../domain/model';
import { arrowheadSegments, closePolygonRing, geodesicCircleCoordinates, rectangleToPolygonRing } from './geometry';

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }
  | { type: 'MultiLineString'; coordinates: Coordinate[][] }
  | { type: 'Polygon'; coordinates: Coordinate[][] };

export interface ProjectGeoJsonProperties {
  featureId: FeatureId;
  featureType: ProjectFeature['type'];
  renderRole: 'marker' | 'text' | 'radius' | 'line' | 'area' | 'arrow-shaft' | 'arrowhead';
  selected: boolean;
  effectiveLocked: boolean;
  color: string;
  fillColor: string;
  weightPx: number;
  opacity: number;
  fillOpacity: number;
  dashArray: string | null;
  previewHeightM: number;
}

export interface ProjectGeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJsonGeometry;
  properties: ProjectGeoJsonProperties;
}

export interface ProjectGeoJson {
  type: 'FeatureCollection';
  features: ProjectGeoJsonFeature[];
}

export interface ProjectDomFeature {
  featureId: FeatureId;
  featureType: 'marker' | 'text';
  coordinate: Coordinate;
  label: string;
  style: FeatureStyle;
  effectiveLocked: boolean;
}

export interface ProjectGeoJsonOptions {
  selectedFeatureId?: FeatureId | null;
  previewExtrusions?: Readonly<Record<FeatureId, number>>;
  circleSegments?: number;
}

function styleDefaults(feature: ProjectFeature): ProjectGeoJsonProperties {
  const defaultColor = feature.type === 'marker' ? '#2563eb' : feature.type === 'text' ? '#1f2937' : feature.type === 'arrow' ? '#10b981' : '#3388ff';
  const color = feature.style.color ?? defaultColor;
  return {
    featureId: feature.id,
    featureType: feature.type,
    renderRole: feature.type === 'marker' ? 'marker' : feature.type === 'text' ? 'text' : feature.type === 'arrow' ? 'arrow-shaft' : feature.type === 'polygon' || feature.type === 'rectangle' || feature.type === 'circle' ? 'area' : 'line',
    selected: false,
    effectiveLocked: false,
    color,
    fillColor: feature.style.fillColor ?? color,
    weightPx: feature.style.weightPx ?? (feature.type === 'arrow' ? 3 : 4),
    opacity: feature.style.opacity ?? 1,
    fillOpacity: feature.style.fillOpacity ?? 0.2,
    dashArray: feature.style.dashArray ?? null,
    previewHeightM: 0
  };
}

function propertiesFor(feature: ProjectFeature, options: ProjectGeoJsonOptions, effectiveLocked: boolean, renderRole: ProjectGeoJsonProperties['renderRole']): ProjectGeoJsonProperties {
  const properties = styleDefaults(feature);
  properties.renderRole = renderRole;
  properties.selected = feature.id === (options.selectedFeatureId ?? null);
  properties.effectiveLocked = effectiveLocked;
  if ((feature.type === 'polygon' || feature.type === 'rectangle') && options.previewExtrusions?.[feature.id] !== undefined) {
    const height = Number(options.previewExtrusions[feature.id]);
    properties.previewHeightM = Number.isFinite(height) && height > 0 ? height : 0;
  }
  return properties;
}

function feature(id: string, geometry: GeoJsonGeometry, properties: ProjectGeoJsonProperties): ProjectGeoJsonFeature {
  return { type: 'Feature', id, geometry, properties };
}

export function projectToGeoJson(project: ProjectDocumentV2, options: ProjectGeoJsonOptions = {}): ProjectGeoJson {
  const groups = new Map(project.groups.map((group) => [group.id, group]));
  const output: ProjectGeoJsonFeature[] = [];
  project.features.forEach((projectFeature) => {
    const group = projectFeature.groupId ? groups.get(projectFeature.groupId) : undefined;
    const state = effectiveState(projectFeature, group);
    if (!state.visible) return;
    if (projectFeature.type === 'marker') {
      output.push(feature(`${projectFeature.id}-marker`, { type: 'Point', coordinates: projectFeature.geometry.coordinates }, propertiesFor(projectFeature, options, state.locked, 'marker')));
      projectFeature.properties.radii.forEach((radius) => {
        const ring = closePolygonRing(geodesicCircleCoordinates(projectFeature.geometry.coordinates, radius.distanceM, options.circleSegments));
        const radiusProperties = propertiesFor(projectFeature, options, state.locked, 'radius');
        radiusProperties.color = radius.color;
        radiusProperties.fillColor = radius.color;
        radiusProperties.fillOpacity = radius.fillOpacity;
        output.push(feature(`${projectFeature.id}-radius-${radius.id}`, { type: 'Polygon', coordinates: [ring] }, radiusProperties));
      });
      return;
    }
    if (projectFeature.type === 'text') {
      output.push(feature(`${projectFeature.id}-text`, { type: 'Point', coordinates: projectFeature.geometry.coordinates }, propertiesFor(projectFeature, options, state.locked, 'text')));
      return;
    }
    if (projectFeature.type === 'polyline') {
      output.push(feature(`${projectFeature.id}-line`, { type: 'LineString', coordinates: projectFeature.geometry.coordinates.map(([longitude, latitude]) => [longitude, latitude]) }, propertiesFor(projectFeature, options, state.locked, 'line')));
      return;
    }
    if (projectFeature.type === 'arrow') {
      output.push(feature(`${projectFeature.id}-shaft`, { type: 'LineString', coordinates: projectFeature.geometry.coordinates.map(([longitude, latitude]) => [longitude, latitude]) }, propertiesFor(projectFeature, options, state.locked, 'arrow-shaft')));
      const arrowhead = arrowheadSegments(projectFeature.geometry.coordinates);
      if (arrowhead.length) {
        const arrowProperties = propertiesFor(projectFeature, options, state.locked, 'arrowhead');
        output.push(feature(`${projectFeature.id}-head`, { type: 'MultiLineString', coordinates: arrowhead }, arrowProperties));
      }
      return;
    }
    const properties = propertiesFor(projectFeature, options, state.locked, 'area');
    const coordinates = projectFeature.type === 'polygon'
      ? closePolygonRing(projectFeature.geometry.coordinates)
      : projectFeature.type === 'rectangle'
        ? rectangleToPolygonRing(projectFeature.geometry)
        : closePolygonRing(geodesicCircleCoordinates(projectFeature.geometry.center, projectFeature.geometry.radiusM, options.circleSegments));
    output.push(feature(`${projectFeature.id}-area`, { type: 'Polygon', coordinates: [coordinates] }, properties));
  });
  return { type: 'FeatureCollection', features: output };
}

export function projectToDomFeatures(project: ProjectDocumentV2): ProjectDomFeature[] {
  const groups = new Map(project.groups.map((group) => [group.id, group]));
  const output: ProjectDomFeature[] = [];
  project.features.forEach((projectFeature) => {
    if (projectFeature.type !== 'marker' && projectFeature.type !== 'text') return;
    const group = projectFeature.groupId ? groups.get(projectFeature.groupId) : undefined;
    const state = effectiveState(projectFeature, group);
    if (!state.visible) return;
    output.push({
      featureId: projectFeature.id,
      featureType: projectFeature.type,
      coordinate: projectFeature.geometry.coordinates,
      label: projectFeature.type === 'text' ? projectFeature.properties.text : projectFeature.name,
      style: { ...projectFeature.style },
      effectiveLocked: state.locked
    });
  });
  return output;
}
