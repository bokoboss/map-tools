import type { Coordinate } from '../../domain/model';

export interface LeafletLatLngLike {
  lat: number;
  lng: number;
}

/** Canonical domain [longitude, latitude] -> Leaflet [latitude, longitude]. */
export function toLeafletLatLng(coordinate: Coordinate): [number, number] {
  return [coordinate[1], coordinate[0]];
}

/** Leaflet runtime latitude/longitude -> canonical domain [longitude, latitude]. */
export function fromLeafletLatLng(latlng: LeafletLatLngLike): Coordinate {
  return [Number(latlng.lng), Number(latlng.lat)];
}

export function toLeafletLatLngs(coordinates: readonly Coordinate[]): [number, number][] {
  return coordinates.map(toLeafletLatLng);
}
