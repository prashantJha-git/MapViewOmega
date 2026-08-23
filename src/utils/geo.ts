import { TransitStop } from '../types/transit';

/**
 * Calculate Haversine distance between two coordinates in meters
 */
export function getHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Format distance in meters to human readable string (e.g. "350 m" or "1.2 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Estimate walking duration in minutes based on distance and walking speed
 * Standard accessible walking speed: ~4.2 km/h (70 meters/min)
 */
export function estimateWalkMinutes(meters: number, speedMetersPerMin: number = 70): number {
  return Math.max(1, Math.round(meters / speedMetersPerMin));
}

/**
 * Point-in-Polygon test using Ray-Casting algorithm
 * point: [lat, lng]
 * polygon: Array of [lat, lng]
 */
export function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate initial bearing between two coordinates in degrees (0 - 360)
 */
export function getBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (Math.round((theta * 180) / Math.PI) + 360) % 360;
}

/**
 * Find the nearest TransitStop to a given coordinate
 */
export function findNearestStop(
  lat: number,
  lng: number,
  stops: TransitStop[]
): { stop: TransitStop; distanceMeters: number } | null {
  if (!stops || stops.length === 0) return null;

  let nearestStop = stops[0];
  let minDistance = getHaversineDistanceMeters(lat, lng, stops[0].lat, stops[0].lng);

  for (let i = 1; i < stops.length; i++) {
    const dist = getHaversineDistanceMeters(lat, lng, stops[i].lat, stops[i].lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestStop = stops[i];
    }
  }

  return { stop: nearestStop, distanceMeters: minDistance };
}

/**
 * Generate interpolated straight-line coordinates between two points
 */
export function interpolatePoints(
  start: [number, number],
  end: [number, number],
  steps: number = 5
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lat = start[0] + (end[0] - start[0]) * ratio;
    const lng = start[1] + (end[1] - start[1]) * ratio;
    points.push([lat, lng]);
  }
  return points;
}
