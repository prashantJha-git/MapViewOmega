export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type TileLayerId = 'osm' | 'voyager' | 'dark' | 'satellite';

export type IncidentCategory =
  | 'medical'
  | 'fire'
  | 'harassment'
  | 'unsafe_area'
  | 'infrastructure'
  | 'lighting'
  | 'obstruction'
  | 'other';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeofenceZone {
  id: string;
  label: string;
  color: string;
  coords: [number, number][]; // [lat, lng] array
  desc: string;
  dangerLevel?: 'safe' | 'caution' | 'warning' | 'hazard';
  /** Where this zone came from — surfaced in the UI so we never imply a
   * static reference zone was derived from live data (or vice versa). */
  source?: 'baseline' | 'live_cluster';
  /** Number of live reports that fed a 'live_cluster' zone. */
  reportCount?: number;
}

export interface MapIncidentPin {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: Severity;
  lat: number;
  lng: number;
  status: 'active' | 'in_progress' | 'resolved';
  description?: string;
  reportedAt: string;
  claimedBy?: string;
  zoneId?: string;
}

export interface AlertRecord {
  id: string;
  zoneId?: string;
  zoneName: string;
  incidentTitle?: string;
  severity: Severity;
  distanceMeters: number;
  message: string;
  timestamp: string;
  acknowledged?: boolean;
}
