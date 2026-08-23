import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeofenceZone, MapIncidentPin, TileLayerId, Severity, AlertRecord, LatLng } from './types';
import { DEFAULT_CAMPUS_ZONES, TILE_LAYERS, checkGeofenceAlerts, playAlertTone, reportToIncidentPin, getActiveZones } from './gridPulseEngine';
import { AlertBanner } from './AlertBanner';
import { CommunityReport, TransitStop } from '../../types/transit';
import { formatDistance } from '../../utils/geo';

interface GridPulsePanelProps {
  reports: CommunityReport[];
  stops: TransitStop[];
  onResolveReport?: (reportId: string) => void;
  onAddNewReport?: (preselectedStopId?: string) => void;
}

const SEV_COLORS: Record<Severity, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#FBBF24',
  low: '#64748B',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  medical: '🚑',
  fire: '🔥',
  harassment: '⚠️',
  unsafe_area: '🚧',
  infrastructure: '🔧',
  lighting: '💡',
  obstruction: '⛔',
  other: '📋',
};

export const GridPulsePanel: React.FC<GridPulsePanelProps> = ({
  reports,
  stops,
  onResolveReport,
  onAddNewReport,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const zonesLayerGroupRef = useRef<any>(null);
  const incidentsLayerGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const [activeTileLayer, setActiveTileLayer] = useState<TileLayerId>('voyager');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [activeAlerts, setActiveAlerts] = useState<AlertRecord[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedIncident, setSelectedIncident] = useState<MapIncidentPin | null>(null);

  // Simulated / live user GPS position
  const [userLocation, setUserLocation] = useState<LatLng>({
    lat: 42.365,
    lng: -71.095,
  });

  // Convert incoming community reports to incident pins
  const [incidents, setIncidents] = useState<MapIncidentPin[]>([]);

  useEffect(() => {
    const pins = reports.map(r => reportToIncidentPin(r, stops));
    setIncidents(pins);
  }, [reports, stops]);

  // Zones shown on the map: a fixed baseline layer PLUS zones dynamically
  // clustered from whatever live, unresolved reports currently exist.
  const zones = useMemo<GeofenceZone[]>(
    () => getActiveZones(DEFAULT_CAMPUS_ZONES, incidents),
    [incidents]
  );

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [42.365, -71.095],
      zoom: 14,
      zoomControl: false,
    });

    const tile = TILE_LAYERS[activeTileLayer];
    tileLayerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      subdomains: tile.subdomains || 'abc',
      maxZoom: tile.maxZoom,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    zonesLayerGroupRef.current = L.layerGroup().addTo(map);
    incidentsLayerGroupRef.current = L.layerGroup().addTo(map);

    // User location marker
    const userIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `
        <div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse ring-4 ring-blue-500/30">
          <div class="w-2 h-2 rounded-full bg-white"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Handle Tile Layer Switch
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const tile = TILE_LAYERS[activeTileLayer];
    tileLayerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      subdomains: tile.subdomains || 'abc',
      maxZoom: tile.maxZoom,
    }).addTo(mapInstanceRef.current);
  }, [activeTileLayer]);

  // 3. Render Geofence Zones (baseline + live-derived clusters)
  useEffect(() => {
    if (!mapInstanceRef.current || !zonesLayerGroupRef.current) return;
    zonesLayerGroupRef.current.clearLayers();

    zones.forEach(zone => {
      const isLive = zone.source === 'live_cluster';
      const polygon = L.polygon(zone.coords, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: zone.dangerLevel === 'hazard' ? 0.25 : 0.12,
        weight: zone.dangerLevel === 'hazard' ? 2.5 : 1.5,
        dashArray: isLive ? '3, 6' : zone.dangerLevel === 'hazard' ? '5, 5' : undefined,
      });

      polygon.bindPopup(`
        <div class="p-2 text-slate-900 font-sans">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
              isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }">${isLive ? '● Live Cluster' : '○ Baseline Zone'}</span>
          </div>
          <div class="font-bold text-sm" style="color: ${zone.color}">${zone.label}</div>
          <div class="text-xs text-slate-600 mt-1">${zone.desc}</div>
          <div class="mt-2 inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-slate-100">
            Status: ${zone.dangerLevel?.toUpperCase() || 'NORMAL'}
          </div>
        </div>
      `);

      polygon.addTo(zonesLayerGroupRef.current);
    });
  }, [zones]);

  // 4. Render Incident Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !incidentsLayerGroupRef.current) return;
    incidentsLayerGroupRef.current.clearLayers();

    const filtered = incidents.filter(
      inc => selectedSeverity === 'all' || inc.severity === selectedSeverity
    );

    filtered.forEach(inc => {
      const color = SEV_COLORS[inc.severity] || '#64748B';
      const emoji = CATEGORY_EMOJIS[inc.category] || '⚠️';

      const customIcon = L.divIcon({
        className: 'custom-incident-pin',
        html: `
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shadow-xl font-bold transition-transform hover:scale-110"
               style="background: ${color}; border: 2px solid #ffffff; box-shadow: 0 0 12px ${color}88;">
            <span>${emoji}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedIncident(inc);
      });

      marker.addTo(incidentsLayerGroupRef.current);
    });
  }, [incidents, selectedSeverity]);

  // 5. Update User Location Marker & Check Geofence Alerts
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }

    const alerts = checkGeofenceAlerts(userLocation, zones, incidents);
    setActiveAlerts(alerts);

    if (alerts.length > 0 && soundEnabled) {
      const hasCritical = alerts.some(a => a.severity === 'critical');
      playAlertTone(hasCritical ? 'critical' : 'warning');
    }
  }, [userLocation, incidents, zones, soundEnabled]);

  const handleDismissAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleClaimIncident = (incId: string) => {
    setIncidents(prev =>
      prev.map(i => (i.id === incId ? { ...i, status: 'in_progress', claimedBy: 'Security Unit Alpha' } : i))
    );
  };

  const handleResolveIncident = (incId: string) => {
    setIncidents(prev => prev.map(i => (i.id === incId ? { ...i, status: 'resolved' } : i)));
    if (onResolveReport) {
      onResolveReport(incId);
    }
    setSelectedIncident(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🛡️</span>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                GridPulse™ Safety & Geofence Map
              </h1>
              <p className="text-sm text-slate-400">
                Dynamic high-resolution incident monitoring, multi-layer geofencing & proximity alerts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center space-x-1.5 ${
              soundEnabled
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span>{soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF'}</span>
          </button>

          <button
            onClick={() => onAddNewReport?.()}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all flex items-center space-x-1.5"
          >
            <span>+ Report Barrier / Hazard</span>
          </button>
        </div>
      </div>

      {/* Main Map & Incident Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map View (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative h-[560px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Map Controls Floating Overlay */}
            <div className="absolute top-4 left-4 z-[400] flex flex-wrap gap-2">
              {/* Tile Selector */}
              <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-xl flex space-x-1">
                {(Object.keys(TILE_LAYERS) as TileLayerId[]).map(layerId => (
                  <button
                    key={layerId}
                    onClick={() => setActiveTileLayer(layerId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeTileLayer === layerId
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {TILE_LAYERS[layerId].name}
                  </button>
                ))}
              </div>

              {/* Severity Filter */}
              <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-xl flex space-x-1">
                {['all', 'critical', 'high', 'medium'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium uppercase transition-colors ${
                      selectedSeverity === sev
                        ? 'bg-slate-700 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS Simulation Controls */}
            <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2">
              <span className="font-semibold text-slate-300 block">📍 Test Geofence Position:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setUserLocation({ lat: 42.365, lng: -71.095 })}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Transit Hub (Safe)
                </button>
                <button
                  onClick={() => setUserLocation({ lat: 42.360, lng: -71.084 })}
                  className="px-2 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900"
                >
                  Riverbank (Hazard Zone)
                </button>
                <button
                  onClick={() => setUserLocation({ lat: 42.358, lng: -71.098 })}
                  className="px-2 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-300 hover:bg-amber-900"
                >
                  Rail Depot (Caution)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Incident List & Selected Incident Details (1 col) */}
        <div className="space-y-4">
          {/* Active Incidents List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl max-h-[560px] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Live Hazard Feed ({incidents.filter(i => i.status !== 'resolved').length})
              </h2>
              <span className="text-xs text-emerald-400 font-mono">Live Pulse 🟢</span>
            </div>

            {incidents.filter(i => i.status !== 'resolved').length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No active safety incidents in current perimeter. All zones operational.
              </div>
            ) : (
              incidents
                .filter(i => i.status !== 'resolved')
                .map(inc => {
                  const color = SEV_COLORS[inc.severity];
                  const emoji = CATEGORY_EMOJIS[inc.category] || '⚠️';

                  return (
                    <div
                      key={inc.id}
                      onClick={() => {
                        setSelectedIncident(inc);
                        mapInstanceRef.current?.setView([inc.lat, inc.lng], 16);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedIncident?.id === inc.id
                          ? 'bg-slate-800 border-emerald-500 shadow-md'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                          style={{ backgroundColor: `${color}25`, color }}
                        >
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white truncate">
                              {inc.title}
                            </span>
                            <span
                              className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${color}30`, color }}
                            >
                              {inc.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {inc.description}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                            <span>{inc.zoneId || 'Transit Zone'}</span>
                            <span>{inc.status === 'in_progress' ? '🟡 Dispatched' : '🔴 Active'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Selected Incident Drawer / Modal */}
      {selectedIncident && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{
                backgroundColor: `${SEV_COLORS[selectedIncident.severity]}25`,
                color: SEV_COLORS[selectedIncident.severity],
              }}
            >
              {CATEGORY_EMOJIS[selectedIncident.category]}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-white">{selectedIncident.title}</h3>
                <span
                  className="text-xs uppercase font-bold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${SEV_COLORS[selectedIncident.severity]}30`,
                    color: SEV_COLORS[selectedIncident.severity],
                  }}
                >
                  {selectedIncident.severity}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Status: {selectedIncident.status}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">{selectedIncident.description}</p>
              {selectedIncident.claimedBy && (
                <p className="text-xs text-emerald-400 mt-1">
                  🛡️ Claimed & Managed by: {selectedIncident.claimedBy}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {selectedIncident.status === 'active' && (
              <button
                onClick={() => handleClaimIncident(selectedIncident.id)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors"
              >
                Claim / Dispatch
              </button>
            )}
            <button
              onClick={() => handleResolveIncident(selectedIncident.id)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
            >
              ✓ Mark Resolved
            </button>
            <button
              onClick={() => setSelectedIncident(null)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Geofence Alert Banner */}
      <AlertBanner
        alerts={activeAlerts}
        onDismiss={handleDismissAlert}
        onSelectAlert={alert => {
          if (alert.zoneId) {
            const zone = zones.find(z => z.id === alert.zoneId);
            if (zone) mapInstanceRef.current?.setView(zone.coords[0], 16);
          }
        }}
      />
    </div>
  );
};
