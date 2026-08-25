import {
  clone,
  createEmptyProject,
  createId
} from '../domain/project';
import {
  SCHEMA_VERSION,
  type Coordinate,
  type FeatureStyle,
  type ProjectDocumentV2,
  type ProjectFeature,
  type ProjectGroup
} from '../domain/model';

const MAX_FEATURES = 5000;
const MAX_GROUPS = 500;
const MAX_COORDINATES = 100000;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type RecordValue = Record<string, unknown>;

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validationError(errors: string[], path: string, message: string): void {
  errors.push(`${path}: ${message}`);
}

function equalCoordinate(a: unknown, b: unknown): boolean {
  return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
}

function validateCoordinate(value: unknown, path: string, errors: string[]): Coordinate | null {
  if (!Array.isArray(value) || value.length !== 2 || !finiteNumber(value[0]) || !finiteNumber(value[1])) {
    validationError(errors, path, 'expected [longitude, latitude] finite numbers');
    return null;
  }
  if (value[0] < -180 || value[0] > 180) validationError(errors, `${path}[0]`, 'longitude must be between -180 and 180');
  if (value[1] < -90 || value[1] > 90) validationError(errors, `${path}[1]`, 'latitude must be between -90 and 90');
  return [value[0], value[1]];
}

function validateColor(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined && (typeof value !== 'string' || !HEX_COLOR.test(value))) {
    validationError(errors, path, 'expected a six-digit hex color');
  }
}

function validateStyle(value: unknown, path: string, errors: string[]): FeatureStyle {
  if (!isRecord(value)) {
    validationError(errors, path, 'expected an object');
    return {};
  }
  const result = clone(value) as RecordValue;
  validateColor(result.color, `${path}.color`, errors);
  validateColor(result.fillColor, `${path}.fillColor`, errors);
  for (const key of ['opacity', 'fillOpacity']) {
    const item = result[key];
    if (item !== undefined && (!finiteNumber(item) || item < 0 || item > 1)) {
      validationError(errors, `${path}.${key}`, 'expected a number between 0 and 1');
    }
  }
  for (const key of ['weightPx', 'fontSizePx']) {
    const item = result[key];
    if (item !== undefined && (!finiteNumber(item) || item < 0 || item > 100)) {
      validationError(errors, `${path}.${key}`, 'expected a finite number between 0 and 100');
    }
  }
  if (result.fontWeight !== undefined && (!Number.isInteger(result.fontWeight) || (result.fontWeight as number) < 100 || (result.fontWeight as number) > 900)) {
    validationError(errors, `${path}.fontWeight`, 'expected an integer between 100 and 900');
  }
  if (result.rotationDeg !== undefined && (!finiteNumber(result.rotationDeg) || result.rotationDeg < -360 || result.rotationDeg > 360)) {
    validationError(errors, `${path}.rotationDeg`, 'expected a finite number between -360 and 360');
  }
  if (result.dashArray !== undefined && result.dashArray !== null && typeof result.dashArray !== 'string') {
    validationError(errors, `${path}.dashArray`, 'expected a string or null');
  }
  if (result.arrowHead !== undefined && result.arrowHead !== 'end') {
    validationError(errors, `${path}.arrowHead`, 'only end is supported');
  }
  return result as FeatureStyle;
}

function validateIds(document: RecordValue, errors: string[]): void {
  const ids = new Set<string>();
  const add = (id: unknown, path: string): void => {
    if (typeof id !== 'string' || id.length === 0) validationError(errors, path, 'expected a non-empty string ID');
    else if (ids.has(id)) validationError(errors, path, `duplicate ID ${id}`);
    else ids.add(id);
  };
  const project = isRecord(document.project) ? document.project : {};
  add(project.id, 'project.id');
  const groups = Array.isArray(document.groups) ? document.groups : [];
  groups.forEach((group, index) => add(isRecord(group) ? group.id : undefined, `groups[${index}].id`));
  const features = Array.isArray(document.features) ? document.features : [];
  features.forEach((feature, index) => add(isRecord(feature) ? feature.id : undefined, `features[${index}].id`));
}

function validateFeature(value: unknown, index: number, groupIds: Set<string>, errors: string[]): ProjectFeature | null {
  const path = `features[${index}]`;
  if (!isRecord(value)) {
    validationError(errors, path, 'expected an object');
    return null;
  }
  const result = clone(value) as RecordValue;
  const type = result.type;
  if (typeof type !== 'string') validationError(errors, `${path}.type`, 'missing feature discriminator');
  if (typeof result.name !== 'string') validationError(errors, `${path}.name`, 'expected a string');
  if (result.groupId !== null && result.groupId !== undefined && (typeof result.groupId !== 'string' || !groupIds.has(result.groupId))) {
    validationError(errors, `${path}.groupId`, 'does not reference an existing group');
  }
  if (typeof result.visible !== 'boolean') validationError(errors, `${path}.visible`, 'expected boolean');
  if (typeof result.locked !== 'boolean') validationError(errors, `${path}.locked`, 'expected boolean');
  result.groupId ??= null;
  result.style = validateStyle(result.style, `${path}.style`, errors);
  if (!isRecord(result.properties)) validationError(errors, `${path}.properties`, 'expected an object');
  result.properties = isRecord(result.properties) ? result.properties : {};
  const geometry = result.geometry;
  if (!isRecord(geometry)) {
    validationError(errors, `${path}.geometry`, 'expected an object');
    return result as unknown as ProjectFeature;
  }

  if (type === 'marker' || type === 'text') {
    if (geometry.kind !== 'point') validationError(errors, `${path}.geometry.kind`, 'expected point');
    const coordinates = validateCoordinate(geometry.coordinates, `${path}.geometry.coordinates`, errors) ?? geometry.coordinates;
    result.geometry = { kind: 'point', coordinates };
    const properties = result.properties as RecordValue;
    if (type === 'marker') {
      if (!Array.isArray(properties.radii)) validationError(errors, `${path}.properties.radii`, 'expected an array');
      const radii = Array.isArray(properties.radii) ? properties.radii : [];
      const radiusIds = new Set<string>();
      properties.radii = radii.map((radius, radiusIndex) => {
        const radiusPath = `${path}.properties.radii[${radiusIndex}]`;
        const item = isRecord(radius) ? clone(radius) : {};
        if (typeof item.id !== 'string' || !item.id) validationError(errors, `${radiusPath}.id`, 'expected a non-empty string ID');
        else if (radiusIds.has(item.id)) validationError(errors, `${radiusPath}.id`, 'duplicate radius ID');
        else radiusIds.add(item.id);
        if (!finiteNumber(item.distanceM) || item.distanceM < 0) validationError(errors, `${radiusPath}.distanceM`, 'expected a non-negative finite number');
        validateColor(item.color, `${radiusPath}.color`, errors);
        if (!finiteNumber(item.fillOpacity) || item.fillOpacity < 0 || item.fillOpacity > 1) validationError(errors, `${radiusPath}.fillOpacity`, 'expected a number between 0 and 1');
        return item;
      });
    } else if (typeof properties.text !== 'string') {
      validationError(errors, `${path}.properties.text`, 'expected plain text');
    }
  } else if (type === 'polyline' || type === 'arrow') {
    if (geometry.kind !== 'lineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      validationError(errors, `${path}.geometry`, 'expected a lineString with at least two coordinates');
    }
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    result.geometry = {
      kind: 'lineString',
      coordinates: coordinates.map((coordinate, coordinateIndex) => validateCoordinate(coordinate, `${path}.geometry.coordinates[${coordinateIndex}]`, errors) ?? coordinate) as Coordinate[]
    };
    if (type === 'arrow' && (result.style as FeatureStyle).arrowHead === undefined) (result.style as FeatureStyle).arrowHead = 'end';
  } else if (type === 'polygon') {
    if (geometry.kind !== 'polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 3) {
      validationError(errors, `${path}.geometry`, 'expected a polygon with at least three coordinates');
    }
    let coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    coordinates = coordinates.map((coordinate, coordinateIndex) => validateCoordinate(coordinate, `${path}.geometry.coordinates[${coordinateIndex}]`, errors) ?? coordinate);
    if (coordinates.length > 3 && equalCoordinate(coordinates[0], coordinates[coordinates.length - 1])) coordinates = coordinates.slice(0, -1);
    result.geometry = { kind: 'polygon', coordinates: coordinates as Coordinate[] };
  } else if (type === 'rectangle') {
    if (geometry.kind !== 'bounds') validationError(errors, `${path}.geometry.kind`, 'expected bounds');
    result.geometry = {
      kind: 'bounds',
      southWest: validateCoordinate(geometry.southWest, `${path}.geometry.southWest`, errors) ?? geometry.southWest,
      northEast: validateCoordinate(geometry.northEast, `${path}.geometry.northEast`, errors) ?? geometry.northEast
    } as ProjectFeature['geometry'];
  } else if (type === 'circle') {
    if (geometry.kind !== 'circle') validationError(errors, `${path}.geometry.kind`, 'expected circle');
    if (!finiteNumber(geometry.radiusM) || geometry.radiusM < 0) validationError(errors, `${path}.geometry.radiusM`, 'expected a non-negative finite number');
    result.geometry = {
      kind: 'circle',
      center: validateCoordinate(geometry.center, `${path}.geometry.center`, errors) ?? geometry.center,
      radiusM: geometry.radiusM
    };
  } else {
    validationError(errors, `${path}.type`, `unsupported feature type ${String(type)}`);
  }
  return result as unknown as ProjectFeature;
}

export function validateProject(input: unknown): ValidationResult<ProjectDocumentV2> {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ['document: expected an object'], warnings: [] };
  const document = clone(input) as RecordValue;
  if (document.schemaVersion !== SCHEMA_VERSION) validationError(errors, 'schemaVersion', `expected ${SCHEMA_VERSION}`);
  if (!isRecord(document.app) || typeof document.app.name !== 'string' || typeof document.app.version !== 'string') validationError(errors, 'app', 'expected name and version');
  if (!isRecord(document.project)) validationError(errors, 'project', 'expected an object');
  if (isRecord(document.project)) {
    for (const key of ['id', 'name', 'createdAt', 'updatedAt']) if (typeof document.project[key] !== 'string' || !document.project[key]) validationError(errors, `project.${key}`, 'expected a non-empty string');
    for (const key of ['createdAt', 'updatedAt']) if (typeof document.project[key] === 'string' && Number.isNaN(Date.parse(document.project[key] as string))) validationError(errors, `project.${key}`, 'expected an ISO-8601 timestamp');
  }
  if (!isRecord(document.mapView)) validationError(errors, 'mapView', 'expected an object');
  if (isRecord(document.mapView)) {
    document.mapView.center = validateCoordinate(document.mapView.center, 'mapView.center', errors) ?? document.mapView.center;
    if (!finiteNumber(document.mapView.zoom) || document.mapView.zoom < 0 || document.mapView.zoom > 24) validationError(errors, 'mapView.zoom', 'expected a number between 0 and 24');
    if (typeof document.mapView.basemapId !== 'string' || !document.mapView.basemapId) validationError(errors, 'mapView.basemapId', 'expected a non-empty string');
  }
  if (!Array.isArray(document.groups) || document.groups.length > MAX_GROUPS) validationError(errors, 'groups', `expected an array with at most ${MAX_GROUPS} items`);
  if (!Array.isArray(document.features) || document.features.length > MAX_FEATURES) validationError(errors, 'features', `expected an array with at most ${MAX_FEATURES} items`);
  const rawGroups = Array.isArray(document.groups) ? document.groups : [];
  const rawFeatures = Array.isArray(document.features) ? document.features : [];
  document.groups = rawGroups;
  document.features = rawFeatures;
  const groupIds = new Set<string>();
  document.groups = rawGroups.map((group: unknown, index: number) => {
    const path = `groups[${index}]`;
    const item = isRecord(group) ? clone(group) : {};
    if (typeof item.id !== 'string' || !item.id) validationError(errors, `${path}.id`, 'expected a non-empty string ID');
    else if (groupIds.has(item.id)) validationError(errors, `${path}.id`, 'duplicate group ID');
    else groupIds.add(item.id);
    if (typeof item.name !== 'string') validationError(errors, `${path}.name`, 'expected a string');
    if (typeof item.visible !== 'boolean') validationError(errors, `${path}.visible`, 'expected boolean');
    if (typeof item.locked !== 'boolean') validationError(errors, `${path}.locked`, 'expected boolean');
    if (!Number.isInteger(item.order)) validationError(errors, `${path}.order`, 'expected an integer');
    return item as unknown as ProjectGroup;
  });
  validateIds(document, errors);
  document.features = rawFeatures.map((feature: unknown, index: number) => validateFeature(feature, index, groupIds, errors));
  const coordinateCount = JSON.stringify(document).match(/\[/g)?.length ?? 0;
  if (coordinateCount > MAX_COORDINATES) validationError(errors, 'document', `too many nested arrays (limit ${MAX_COORDINATES})`);
  return { valid: errors.length === 0, value: document as unknown as ProjectDocumentV2, errors, warnings: [] };
}

export function normalizeProject(input: unknown): ProjectDocumentV2 {
  const result = validateProject(input);
  if (!result.valid || !result.value) throw new Error(`Invalid Project Schema v2:\n${result.errors.join('\n')}`);
  return result.value;
}

export function serializeProject(input: ProjectDocumentV2): string {
  return JSON.stringify(normalizeProject(input), null, 2);
}

function legacyCoordinate(value: unknown): unknown {
  if (Array.isArray(value)) return [Number(value[1]), Number(value[0])];
  if (isRecord(value) && finiteNumber(Number(value.lat)) && finiteNumber(Number(value.lng ?? value.lon))) return [Number(value.lng ?? value.lon), Number(value.lat)];
  return value;
}

function legacyStyle(properties: RecordValue, fallbackColor: string): FeatureStyle {
  const style = isRecord(properties.style) ? clone(properties.style) as RecordValue : {};
  style.color ??= fallbackColor;
  if (style.fillColor === undefined && properties.fillColor) style.fillColor = properties.fillColor;
  if (style.weightPx === undefined && style.weight !== undefined) style.weightPx = style.weight;
  return style as FeatureStyle;
}

export function migrateV1(input: unknown): { document: ProjectDocumentV2; warnings: string[] } {
  if (!isRecord(input) || (!Array.isArray(input.markers) && !isRecord(input.drawnShapes))) throw new Error('Unsupported project file: expected Project Schema v2 or the known v1 shape');
  const document = createEmptyProject({ name: 'Migrated v1 Map' });
  const warnings: string[] = [];
  const markers = Array.isArray(input.markers) ? input.markers : [];
  markers.forEach((rawMarker, index) => {
    const marker = isRecord(rawMarker) ? rawMarker : {};
    const rawRadii = Array.isArray(marker.radii) ? marker.radii : [];
    const radii = rawRadii.map((rawRadius) => {
      const radius = isRecord(rawRadius) ? rawRadius : {};
      return {
        id: createId('radius'),
        distanceM: Number(radius.distance ?? radius.distanceM),
        color: typeof radius.color === 'string' ? radius.color : '#3388ff',
        fillOpacity: radius.fillOpacity === undefined ? 0.2 : Number(radius.fillOpacity)
      };
    });
    document.features.push({
      id: createId('feature'),
      type: 'marker',
      name: String(marker.labelText || `Marker ${index + 1}`),
      groupId: null,
      visible: true,
      locked: false,
      geometry: { kind: 'point', coordinates: legacyCoordinate(marker.latlng ?? marker.position) as Coordinate },
      style: { color: typeof marker.markerColor === 'string' ? marker.markerColor : '#2563eb', symbolId: 'pin' },
      properties: { radii }
    });
  });
  const featureCollection = isRecord(input.drawnShapes) ? input.drawnShapes : {};
  const features = featureCollection.type === 'FeatureCollection' && Array.isArray(featureCollection.features) ? featureCollection.features : [];
  features.forEach((rawFeature, index) => {
    const feature = isRecord(rawFeature) ? rawFeature : {};
    const geometry = isRecord(feature.geometry) ? feature.geometry : null;
    const properties = isRecord(feature.properties) ? feature.properties : {};
    if (!geometry) {
      warnings.push(`drawnShapes[${index}] has no geometry and was skipped`);
      return;
    }
    const geometryType = geometry.type;
    const style = legacyStyle(properties, geometryType === 'Polygon' ? '#f06eaa' : '#3388ff');
    const common = { id: createId('feature'), name: String(properties.name || `Migrated ${String(geometryType)}`), groupId: null, visible: true, locked: false, style, properties: {} };
    if (geometryType === 'LineString' && Array.isArray(geometry.coordinates)) document.features.push({ ...common, type: 'polyline', geometry: { kind: 'lineString', coordinates: geometry.coordinates as Coordinate[] } });
    else if (geometryType === 'Polygon' && Array.isArray(geometry.coordinates) && Array.isArray(geometry.coordinates[0])) document.features.push({ ...common, type: 'polygon', geometry: { kind: 'polygon', coordinates: geometry.coordinates[0] as Coordinate[] } });
    else if (geometryType === 'Point' && properties.radius !== undefined) document.features.push({ ...common, type: 'circle', geometry: { kind: 'circle', center: geometry.coordinates as Coordinate, radiusM: Number(properties.radius) } });
    else if (geometryType === 'Point') warnings.push(`drawnShapes[${index}] point semantics were ambiguous and were not invented`);
    else warnings.push(`drawnShapes[${index}] geometry ${String(geometryType)} was not recoverable and was skipped`);
  });
  return { document: normalizeProject(document), warnings };
}

export function deserializeProject(input: unknown): { document: ProjectDocumentV2; warnings: string[] } {
  let value: unknown;
  try {
    value = typeof input === 'string' ? JSON.parse(input) as unknown : clone(input);
  } catch (error) {
    throw new Error(`Invalid project JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (isRecord(value) && value.schemaVersion === SCHEMA_VERSION) return { document: normalizeProject(value), warnings: [] };
  if (isRecord(value) && value.schemaVersion !== undefined) throw new Error(`Unsupported project schema version: ${String(value.schemaVersion)}`);
  return migrateV1(value);
}

export function effectiveState(feature: Pick<ProjectFeature, 'visible' | 'locked'>, group?: Pick<ProjectGroup, 'visible' | 'locked'> | null) {
  return {
    visible: Boolean(feature.visible && (!group || group.visible)),
    locked: Boolean(feature.locked || (group && group.locked))
  };
}

export { SCHEMA_VERSION, clone, createEmptyProject, createId };
