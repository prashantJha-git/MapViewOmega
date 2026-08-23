import { GeofenceZone, MapIncidentPin, TileLayerId, AlertRecord, LatLng } from './types';
import { CommunityReport, TransitStop } from '../../types/transit';
import { getHaversineDistanceMeters, isPointInPolygon, formatDistance } from '../../utils/geo';

export const TILE_LAYERS: Record<
  TileLayerId,
  { name: string; url: string; subdomains?: string; maxZoom: number; attribution: string }
> = {
  voyager: {
    name: 'CARTO Clean',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  },
  dark: {
    name: 'Tactical Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; CARTO &copy; OSM',
  },
  satellite: {
    name: 'Satellite View',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 18,
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
};

const SEVERITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Build an approximate circular polygon (in lat/lng) around a center point.
 * Used to draw a real-time hazard zone around a cluster of live reports.
 */
function buildCirclePolygon(
  lat: number,
  lng: number,
  radiusMeters: number,
  sides: number = 16
): [number, number][] {
  const coords: [number, number][] = [];
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.max(0.1, Math.cos(latRad));

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    const dLat = (radiusMeters * Math.cos(angle)) / metersPerDegLat;
    const dLng = (radiusMeters * Math.sin(angle)) / metersPerDegLng;
    coords.push([lat + dLat, lng + dLng]);
  }
  return coords;
}

/**
 * Cluster live, unresolved incident pins by proximity and turn each cluster
 * into a real geofence zone. This is what actually makes GridPulse "dynamic":
 * these zones are computed fresh from whatever CommunityReports exist right
 * now, unlike DEFAULT_CAMPUS_ZONES below, which is a fixed baseline layer.
 *
 * A cluster only becomes a zone if it has 2+ nearby reports, or a single
 * critical-severity report — a single low/medium report isn't treated as
 * a "zone" on its own, just a pin.
 */
export function deriveLiveClusterZones(
  incidents: MapIncidentPin[],
  clusterRadiusMeters: number = 180
): GeofenceZone[] {
  const active = incidents.filter(i => i.status !== 'resolved');
  const visited = new Set<string>();
  const clusters: MapIncidentPin[][] = [];

  for (const inc of active) {
    if (visited.has(inc.id)) continue;
    const cluster: MapIncidentPin[] = [inc];
    visited.add(inc.id);

    for (const other of active) {
      if (visited.has(other.id)) continue;
      const dist = getHaversineDistanceMeters(inc.lat, inc.lng, other.lat, other.lng);
      if (dist <= clusterRadiusMeters) {
        cluster.push(other);
        visited.add(other.id);
      }
    }
    clusters.push(cluster);
  }

  return clusters
    .filter(cluster => cluster.length >= 2 || cluster.some(i => i.severity === 'critical'))
    .map((cluster, idx) => {
      const centroidLat = cluster.reduce((s, i) => s + i.lat, 0) / cluster.length;
      const centroidLng = cluster.reduce((s, i) => s + i.lng, 0) / cluster.length;
      const maxRank = Math.max(...cluster.map(i => SEVERITY_RANK[i.severity] || 1));
      const dangerLevel: GeofenceZone['dangerLevel'] =
        maxRank >= 4 ? 'hazard' : maxRank >= 3 ? 'caution' : 'safe';
      const color =
        dangerLevel === 'hazard' ? '#EF4444' : dangerLevel === 'caution' ? '#F59E0B' : '#3B82F6';
      const radius = Math.max(70, clusterRadiusMeters * 0.55);
      const areaName = cluster[0].zoneId || 'Nearby Area';

      return {
        id: `live_cluster_${cluster.map(i => i.id).sort().join('_')}`,
        label: `Live Cluster: ${cluster.length} report${cluster.length > 1 ? 's' : ''} near ${areaName}`,
        color,
        coords: buildCirclePolygon(centroidLat, centroidLng, radius),
        desc: `Auto-generated from ${cluster.length} active community report(s): ${cluster
          .map(i => i.title)
          .join('; ')}`,
        dangerLevel,
        source: 'live_cluster',
        reportCount: cluster.length,
      } as GeofenceZone;
    });
}

/**
 * Combine the fixed baseline reference zones with zones dynamically derived
 * from live incident reports. Every zone is tagged with `source` so the UI
 * can be honest about which is which.
 */
export function getActiveZones(
  baselineZones: GeofenceZone[],
  incidents: MapIncidentPin[],
  clusterRadiusMeters: number = 180
): GeofenceZone[] {
  const baseline = baselineZones.map(z => ({ ...z, source: 'baseline' as const }));
  const live = deriveLiveClusterZones(incidents, clusterRadiusMeters);
  return [...baseline, ...live];
}

export const DEFAULT_CAMPUS_ZONES: GeofenceZone[] = [
  {
    id: 'zone_central_corridor',
    label: 'Central Transit Corridor & Hub',
    color: '#3B82F6',
    coords: [
      [42.368, -71.102],
      [42.368, -71.088],
      [42.361, -71.088],
      [42.361, -71.102],
    ],
    desc: 'High-density multi-modal connection zone, Blue-Light SOS stations, 24/7 CCTV surveillance.',
    dangerLevel: 'safe',
  },
  {
    id: 'zone_north_quad',
    label: 'North Academic & Library Perimeter',
    color: '#10B981',
    coords: [
      [42.373, -71.104],
      [42.373, -71.092],
      [42.368, -71.092],
      [42.368, -71.104],
    ],
    desc: 'Pedestrian plaza, step-free ramps, library night-shuttle stop.',
    dangerLevel: 'safe',
  },
  {
    id: 'zone_south_depot',
    label: 'South Rail & Maintenance Yard',
    color: '#F59E0B',
    coords: [
      [42.361, -71.106],
      [42.361, -71.095],
      [42.355, -71.095],
      [42.355, -71.106],
    ],
    desc: 'Active rail maintenance corridor, uneven grade, elevator repair work.',
    dangerLevel: 'caution',
  },
  {
    id: 'zone_east_crossing',
    label: 'East Riverbank Underpass',
    color: '#EF4444',
    coords: [
      [42.364, -71.088],
      [42.364, -71.080],
      [42.358, -71.080],
      [42.358, -71.088],
    ],
    desc: 'Low lighting alert zone, reported streetlight outage, cautionary escort recommended after 21:00.',
    dangerLevel: 'hazard',
  },
];

/**
 * Convert a CommunityReport into a MapIncidentPin
 */
export function reportToIncidentPin(
  report: CommunityReport,
  stops: TransitStop[]
): MapIncidentPin {
  let lat = 42.365;
  let lng = -71.095;

  if (report.stopId) {
    const matchingStop = stops.find(s => s.id === report.stopId);
    if (matchingStop) {
      lat = matchingStop.lat;
      lng = matchingStop.lng;
    }
  }

  // Category mapping
  let category: MapIncidentPin['category'] = 'other';
  if (report.type === 'broken_elevator' || report.type === 'escalator_down') {
    category = 'infrastructure';
  } else if (report.type === 'dim_lighting') {
    category = 'lighting';
  } else if (report.type === 'obstruction' || report.type === 'broken_ramp') {
    category = 'obstruction';
  } else if (report.type === 'sos_alert') {
    category = 'harassment';
  } else if (report.category === 'Safety Emergency') {
    category = 'medical';
  } else if (report.category === 'Safety Issue') {
    category = 'unsafe_area';
  }

  return {
    id: report.id,
    title: report.title,
    category,
    severity: report.severity,
    lat: lat + (Math.random() - 0.5) * 0.0006, // Slight jitter for overlapping reports at same stop
    lng: lng + (Math.random() - 0.5) * 0.0006,
    status: report.status,
    description: report.details,
    reportedAt: report.timestamp,
    zoneId: report.stopName,
  };
}

/**
 * Check for Geofence collisions and proximity hazard alerts
 */
export function checkGeofenceAlerts(
  userLoc: LatLng,
  zones: GeofenceZone[],
  incidents: MapIncidentPin[],
  proximityThresholdMeters: number = 250
): AlertRecord[] {
  const alerts: AlertRecord[] = [];

  // 1. Check if user is inside any active hazard / caution geofence zone
  for (const zone of zones) {
    const isInside = isPointInPolygon([userLoc.lat, userLoc.lng], zone.coords);
    if (isInside && (zone.dangerLevel === 'hazard' || zone.dangerLevel === 'caution')) {
      alerts.push({
        id: `alert_zone_${zone.id}`,
        zoneId: zone.id,
        zoneName: zone.label,
        severity: zone.dangerLevel === 'hazard' ? 'critical' : 'medium',
        distanceMeters: 0,
        message: `Geofence Alert: You are inside "${zone.label}". ${zone.desc}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }

  // 2. Check distance to active unresolved incidents
  for (const inc of incidents) {
    if (inc.status === 'resolved') continue;

    const dist = getHaversineDistanceMeters(userLoc.lat, userLoc.lng, inc.lat, inc.lng);
    const threshold = inc.severity === 'critical' ? proximityThresholdMeters * 1.5 : proximityThresholdMeters;

    if (dist <= threshold) {
      alerts.push({
        id: `alert_inc_${inc.id}`,
        zoneName: inc.zoneId || 'Nearby Zone',
        incidentTitle: inc.title,
        severity: inc.severity,
        distanceMeters: dist,
        message: `${inc.severity.toUpperCase()} ALERT: "${inc.title}" reported ${formatDistance(dist)} from your current position.`,
        timestamp: inc.reportedAt || new Date().toLocaleTimeString(),
      });
    }
  }

  return alerts;
}

/**
 * Play an accessible audio chime alert using standard Web Audio API
 */
export function playAlertTone(type: 'warning' | 'critical' = 'warning') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'critical') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}
