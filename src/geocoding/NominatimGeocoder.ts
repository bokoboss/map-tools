import type { Coordinate } from '../domain/model';
import type { GeocodingResult, GeocodingService, ReverseGeocodingResult } from './GeocodingService';

interface NominatimResult {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
}

function validCoordinate(lon: number, lat: number): boolean {
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

export class NominatimGeocoder implements GeocodingService {
  constructor(private readonly endpoint = 'https://nominatim.openstreetmap.org') {}

  async search(query: string): Promise<GeocodingResult[]> {
    const url = `${this.endpoint}/search?format=json&q=${encodeURIComponent(query)}&accept-language=th`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json() as unknown;
    if (!Array.isArray(data)) return [];
    return data.flatMap((item, index) => this.normalize(item, index));
  }

  private normalize(value: unknown, index: number): GeocodingResult[] {
    if (!value || typeof value !== 'object') return [];
    const item = value as NominatimResult;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const boundingBox = item.boundingbox?.map(Number);
    return [{
      id: String(item.place_id ?? `${lat},${lon},${index}`),
      label: typeof item.display_name === 'string' ? item.display_name : `${lat}, ${lon}`,
      lat,
      lon,
      boundingBox: boundingBox?.length === 4 ? [boundingBox[0], boundingBox[1], boundingBox[2], boundingBox[3]] : undefined
    }];
  }

  async reverse(coordinate: Coordinate): Promise<ReverseGeocodingResult | null> {
    const [lon, lat] = coordinate;
    const url = `${this.endpoint}/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&accept-language=th`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json() as unknown;
    if (!data || typeof data !== 'object') return null;
    const item = data as NominatimResult;
    const resultLat = Number(item.lat);
    const resultLon = Number(item.lon);
    if (!validCoordinate(resultLon, resultLat)) return null;
    const label = typeof item.display_name === 'string' ? item.display_name.trim() : '';
    if (!label) return null;
    return { label, coordinate: [resultLon, resultLat] };
  }
}
