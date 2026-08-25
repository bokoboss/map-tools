import type { Coordinate } from '../domain/model';

const EARTH_RADIUS_M = 6371008.8;
const radians = (value: number): number => value * Math.PI / 180;

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const latitude1 = radians(a[1]);
  const latitude2 = radians(b[1]);
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = radians(b[0] - a[0]);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function polylineLength(coordinates: readonly Coordinate[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) total += distanceMeters(coordinates[index - 1], coordinates[index]);
  return total;
}

export function polygonAreaSquareMeters(coordinates: readonly Coordinate[]): number {
  if (coordinates.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < coordinates.length; index += 1) {
    const current = coordinates[index];
    const next = coordinates[(index + 1) % coordinates.length];
    area += radians(next[0] - current[0]) * (2 + Math.sin(radians(current[1])) + Math.sin(radians(next[1])));
  }
  return Math.abs(area * EARTH_RADIUS_M ** 2 / 2);
}

export function formatDistance(distance: number): string {
  return distance > 1000 ? `ระยะทาง: ${(distance / 1000).toFixed(2)} กม.` : `ระยะทาง: ${distance.toFixed(0)} เมตร`;
}

export function formatArea(area: number): string {
  const rai = Math.floor(area / 1600);
  const ngan = Math.floor((area % 1600) / 400);
  const squareWa = ((area % 400) / 4).toFixed(2);
  return area >= 4
    ? `พื้นที่: ${area.toLocaleString(undefined, { maximumFractionDigits: 2 })} ตร.ม. (${rai} ไร่ ${ngan} งาน ${squareWa} ตร.วา)`
    : `พื้นที่: ${area.toLocaleString(undefined, { maximumFractionDigits: 2 })} ตร.ม.`;
}
