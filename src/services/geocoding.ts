import { getHaversineDistanceMeters, estimateWalkMinutes, interpolatePoints } from '../utils/geo';
import { TransitStop } from '../types/transit';

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  importance?: number;
}

export interface WalkingRouteResult {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationMin: number;
  isEstimated: boolean; // true if straight-line fallback was used
}

export class GeocodingService {
  /**
   * Search for addresses/places using OpenStreetMap Nominatim API with local stops fallback
   */
  public static async searchAddress(
    query: string,
    localStops: TransitStop[] = []
  ): Promise<GeocodingResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const localMatches: GeocodingResult[] = localStops
      .filter(
        s =>
          s.name.toLowerCase().includes(cleanQuery) ||
          s.code.toLowerCase().includes(cleanQuery) ||
          s.zone.toLowerCase().includes(cleanQuery) ||
          s.description.toLowerCase().includes(cleanQuery)
      )
      .map(s => ({
        displayName: `${s.name} (${s.code}) - ${s.zone}`,
        lat: s.lat,
        lng: s.lng,
        type: 'transit_stop',
        importance: 1.0,
      }));

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&addressdetails=1`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const apiResults: GeocodingResult[] = data.map((item: any) => ({
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type || 'place',
          importance: item.importance,
        }));

        // Combine local stop matches with online geocoding results
        return [...localMatches, ...apiResults];
      }
    } catch (err) {
      console.warn('Nominatim geocoding fetch failed, using local search matches:', err);
    }

    return localMatches;
  }

  /**
   * Reverse geocode a latitude and longitude to a human-friendly address
   */
  public static async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 3).join(', ').trim();
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
    }

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  /**
   * Calculate a real walking route between two coordinates using OSRM Public Walking API,
   * falling back to Haversine straight-line if offline or rate-limited.
   */
  public static async getWalkingRoute(
    origin: [number, number], // [lat, lng]
    dest: [number, number] // [lat, lng]
  ): Promise<WalkingRouteResult> {
    const straightDist = getHaversineDistanceMeters(
      origin[0],
      origin[1],
      dest[0],
      dest[1]
    );

    // If identical or negligible distance
    if (straightDist < 10) {
      return {
        coordinates: [origin, dest],
        distanceMeters: straightDist,
        durationMin: 1,
        isEstimated: false,
      };
    }

    try {
      // OSRM expects coordinates in lng,lat order
      const url = `https://router.project-osrm.org/route/v1/walking/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // GeoJSON coordinates are [lng, lat], convert back to Leaflet [lat, lng]
          const coords: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          const distanceMeters = Math.round(route.distance);
          const durationMin = Math.max(1, Math.round(route.duration / 60));

          return {
            coordinates: coords,
            distanceMeters,
            durationMin,
            isEstimated: false,
          };
        }
      }
    } catch (err) {
      console.warn('OSRM walking routing failed, falling back to Haversine estimate:', err);
    }

    // Fallback: Interpolated straight line
    return {
      coordinates: interpolatePoints(origin, dest, 6),
      distanceMeters: straightDist,
      durationMin: estimateWalkMinutes(straightDist),
      isEstimated: true,
    };
  }
}
