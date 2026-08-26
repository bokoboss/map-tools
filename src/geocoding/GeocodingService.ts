import type { Coordinate } from '../domain/model';

export interface GeocodingResult {
  id: string;
  label: string;
  lat: number;
  lon: number;
  boundingBox?: [number, number, number, number];
}

export interface ReverseGeocodingResult {
  label: string;
  coordinate: Coordinate;
}

export interface GeocodingService {
  search(query: string): Promise<GeocodingResult[]>;
  reverse(coordinate: Coordinate): Promise<ReverseGeocodingResult | null>;
}
