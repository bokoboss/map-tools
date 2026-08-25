import type { GeocodingResult, GeocodingService } from './GeocodingService';

interface NominatimResult {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
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
      label: item.display_name ?? `${lat}, ${lon}`,
      lat,
      lon,
      boundingBox: boundingBox?.length === 4 ? [boundingBox[0], boundingBox[1], boundingBox[2], boundingBox[3]] : undefined
    }];
  }
}
