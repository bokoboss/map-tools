export interface GeocodingResult {
  id: string;
  label: string;
  lat: number;
  lon: number;
  boundingBox?: [number, number, number, number];
}

export interface GeocodingService {
  search(query: string): Promise<GeocodingResult[]>;
}
