import type { Coordinate, LineStringGeometry, PolygonGeometry, BoundsGeometry, CircleGeometry } from '../../domain/model';

export const EARTH_RADIUS_M = 6_371_008.8;
export const DEFAULT_GEODESIC_SEGMENTS = 64;

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}

function coordinatesEqual(left: Coordinate, right: Coordinate): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export function closePolygonRing(coordinates: readonly Coordinate[]): Coordinate[] {
  if (!coordinates.length) return [];
  const ring = coordinates.map(([longitude, latitude]) => [longitude, latitude] as Coordinate);
  if (!coordinatesEqual(ring[0], ring[ring.length - 1])) ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

export function rectangleToPolygonRing(bounds: BoundsGeometry): Coordinate[] {
  const [south, west] = [bounds.southWest[1], bounds.southWest[0]];
  const [north, east] = [bounds.northEast[1], bounds.northEast[0]];
  return closePolygonRing([
    [west, south],
    [east, south],
    [east, north],
    [west, north]
  ]);
}

export function destinationPoint(origin: Coordinate, distanceM: number, bearingDeg: number): Coordinate {
  if (!Number.isFinite(distanceM) || distanceM < 0) throw new RangeError('Distance must be a finite non-negative number');
  if (!Number.isFinite(bearingDeg)) throw new RangeError('Bearing must be finite');
  const angularDistance = distanceM / EARTH_RADIUS_M;
  const latitude = radians(origin[1]);
  const longitude = radians(origin[0]);
  const bearing = radians(bearingDeg);
  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const nextLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude)
  );
  return [normalizeLongitude(degrees(nextLongitude)), degrees(nextLatitude)];
}

export function geodesicCircleCoordinates(center: Coordinate, radiusM: number, segments = DEFAULT_GEODESIC_SEGMENTS): Coordinate[] {
  if (!Number.isFinite(radiusM) || radiusM < 0) throw new RangeError('Circle radius must be a finite non-negative number');
  const count = Number.isFinite(segments) ? Math.max(3, Math.floor(segments)) : DEFAULT_GEODESIC_SEGMENTS;
  const coordinates: Coordinate[] = [];
  for (let index = 0; index <= count; index += 1) {
    coordinates.push(destinationPoint(center, radiusM, index * 360 / count));
  }
  return coordinates;
}

export function haversineDistanceM(left: Coordinate, right: Coordinate): number {
  const latitudeDelta = radians(right[1] - left[1]);
  const longitudeDelta = radians(right[0] - left[0]);
  const leftLatitude = radians(left[1]);
  const rightLatitude = radians(right[1]);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function initialBearingDegrees(origin: Coordinate, destination: Coordinate): number {
  if (haversineDistanceM(origin, destination) <= 1e-7) return 0;
  const latitude = radians(origin[1]);
  const nextLatitude = radians(destination[1]);
  const longitudeDelta = radians(destination[0] - origin[0]);
  const bearing = degrees(Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(nextLatitude),
    Math.cos(latitude) * Math.sin(nextLatitude) - Math.sin(latitude) * Math.cos(nextLatitude) * Math.cos(longitudeDelta)
  ));
  return (bearing + 360) % 360;
}

export interface NonDegenerateSegment {
  from: Coordinate;
  to: Coordinate;
  distanceM: number;
  bearingDeg: number;
}

export function lastNonDegenerateSegment(coordinates: readonly Coordinate[]): NonDegenerateSegment | null {
  for (let index = coordinates.length - 1; index > 0; index -= 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const distanceM = haversineDistanceM(from, to);
    if (distanceM > 1e-7) return { from, to, distanceM, bearingDeg: initialBearingDegrees(from, to) };
  }
  return null;
}

/** Renderer-only arrowhead wings. The canonical arrow remains a LineString. */
export function arrowheadSegments(coordinates: readonly Coordinate[], nominalSizeM = 30): Coordinate[][] {
  const segment = lastNonDegenerateSegment(coordinates);
  if (!segment) return [];
  const sizeM = Math.min(nominalSizeM, Math.max(8, segment.distanceM * 0.35));
  const tip = segment.to;
  const left = destinationPoint(tip, sizeM, segment.bearingDeg + 150);
  const right = destinationPoint(tip, sizeM, segment.bearingDeg - 150);
  return [[tip, left], [tip, right]];
}

export function polygonRingFromGeometry(geometry: PolygonGeometry | BoundsGeometry | CircleGeometry): Coordinate[] {
  if (geometry.kind === 'polygon') return closePolygonRing(geometry.coordinates);
  if (geometry.kind === 'bounds') return rectangleToPolygonRing(geometry);
  return closePolygonRing(geodesicCircleCoordinates(geometry.center, geometry.radiusM));
}

export function lineCoordinatesFromGeometry(geometry: LineStringGeometry): Coordinate[] {
  return geometry.coordinates.map(([longitude, latitude]) => [longitude, latitude] as Coordinate);
}
