import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  TransitStop,
  RouteCandidate,
  TripPoint,
  PickPointMode,
  CommunityReport,
  TileLayerId,
} from '../types/transit';
import { GeocodingService, GeocodingResult } from '../services/geocoding';
import { TILE_LAYERS, DEFAULT_CAMPUS_ZONES, reportToIncidentPin } from '../features/gridpulse/gridPulseEngine';

interface MapViewProps {
  stops: TransitStop[];
  selectedRoute: RouteCandidate | null;
  originPoint?: TripPoint;
  destPoint?: TripPoint;
  onSetOrigin?: (stopId: string) => void;
  onSetDest?: (stopId: string) => void;
  onSelectOriginPoint?: (point: TripPoint) => void;
  onSelectDestPoint?: (point: TripPoint) => void;
  pickMode?: PickPointMode;
  onSetPickMode?: (mode: PickPointMode) => void;
  onReportStop?: (stopId: string) => void;
  reports?: CommunityReport[];
  showSafetyOverlay?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  stops,
  selectedRoute,
  originPoint,
  destPoint,
  onSetOrigin,
  onSetDest,
  onSelectOriginPoint,
  onSelectDestPoint,
  pickMode = 'none',
  onSetPickMode,
  onReportStop,
  reports = [],
  showSafetyOverlay = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const routeLayersRef = useRef<any[]>([]);
  const markersRef = useRef<{ [id: string]: any }>({});
  const customPinsRef = useRef<{ origin?: any; dest?: any }>({});
  const safetyLayerGroupRef = useRef<any>(null);

  // Address search bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeTileLayer, setActiveTileLayer] = useState<TileLayerId>('voyager');
  const [isSafetyVisible, setIsSafetyVisible] = useState<boolean>(showSafetyOverlay);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if (typeof L === 'undefined') {
      console.warn('Leaflet L is not loaded yet');
      return;
    }

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

    safetyLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Render stops markers
    renderStops(map, stops);

    // Click handler for picking any custom location on the map
    map.on('click', async (e: any) => {
      const { lat, lng } = e.latlng;
      if (pickMode === 'origin' && onSelectOriginPoint) {
        const address = await GeocodingService.reverseGeocode(lat, lng);
        onSelectOriginPoint({
          type: 'custom',
          name: `Custom Start (${address})`,
          lat,
          lng,
          address,
        });
        onSetPickMode?.('none');
      } else if (pickMode === 'destination' && onSelectDestPoint) {
        const address = await GeocodingService.reverseGeocode(lat, lng);
        onSelectDestPoint({
          type: 'custom',
          name: `Custom End (${address})`,
          lat,
          lng,
          address,
        });
        onSetPickMode?.('none');
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickMode, onSelectOriginPoint, onSelectDestPoint, onSetPickMode]);

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

  // 3. Render / Update Stop Markers
  const renderStops = (map: any, stopList: TransitStop[]) => {
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    stopList.forEach(stop => {
      const isBarrier = stop.elevatorStatus === 'broken' || !stop.stepFree;
      const isHighSafe = stop.lightingScore >= 9.2;

      let markerBg = '#10b981';
      let iconSymbol = '🦼';

      if (isBarrier) {
        markerBg = '#ef4444';
        iconSymbol = '⚠️';
      } else if (isHighSafe) {
        markerBg = '#059669';
        iconSymbol = '🛡️';
      }

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="custom-marker-pin shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110" style="background-color: ${markerBg}; border: 2px solid #fff; width: 32px; height: 32px; border-radius: 50%; font-size: 14px;" title="${stop.name}">
            <span>${iconSymbol}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map);

      const popupHtml = `
        <div class="p-3 text-slate-900 font-sans" style="min-width: 220px; font-family: 'Inter', sans-serif;">
          <div class="flex items-center justify-between mb-1">
            <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${stop.zone}</span>
            <span style="font-size: 11px; font-weight: 800; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${stop.code}</span>
          </div>
          <h4 style="font-size: 13px; font-weight: 800; margin: 0 0 6px 0; color: #0f172a;">${stop.name}</h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; margin-bottom: 8px;">
            <div style="padding: 2px 6px; border-radius: 4px; background: ${stop.stepFree ? '#dcfce7' : '#fee2e2'}; color: ${stop.stepFree ? '#166534' : '#991b1b'}; font-weight: 700;">
              ${stop.stepFree ? '✓ Step-Free' : '⚠️ Has Stairs'}
            </div>
            <div style="padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #334155; font-weight: 600;">
              💡 ${stop.lightingScore}/10 Light
            </div>
            <div style="padding: 2px 6px; border-radius: 4px; background: ${stop.elevatorStatus === 'broken' ? '#fee2e2' : '#f1f5f9'}; color: ${stop.elevatorStatus === 'broken' ? '#991b1b' : '#334155'}; font-weight: 600;">
              🛗 Elev: ${stop.elevatorStatus}
            </div>
            <div style="padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #334155; font-weight: 600;">
              👥 ${stop.crowdLevel}
            </div>
          </div>

          <div style="display: flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <button id="popup-origin-${stop.id}" style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 700; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Set Origin
            </button>
            <button id="popup-dest-${stop.id}" style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 700; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Set Dest
            </button>
          </div>

          <div style="margin-top: 4px;">
            <button id="popup-report-${stop.id}" style="width: 100%; padding: 4px 8px; font-size: 10px; font-weight: 700; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 6px; cursor: pointer;">
              ⚠️ Report Barrier at this Stop
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const originBtn = document.getElementById(`popup-origin-${stop.id}`);
        const destBtn = document.getElementById(`popup-dest-${stop.id}`);
        const reportBtn = document.getElementById(`popup-report-${stop.id}`);

        if (originBtn) {
          originBtn.onclick = () => {
            if (onSelectOriginPoint) {
              onSelectOriginPoint({
                type: 'stop',
                id: stop.id,
                name: stop.name,
                lat: stop.lat,
                lng: stop.lng,
              });
            } else if (onSetOrigin) {
              onSetOrigin(stop.id);
            }
            marker.closePopup();
          };
        }
        if (destBtn) {
          destBtn.onclick = () => {
            if (onSelectDestPoint) {
              onSelectDestPoint({
                type: 'stop',
                id: stop.id,
                name: stop.name,
                lat: stop.lat,
                lng: stop.lng,
              });
            } else if (onSetDest) {
              onSetDest(stop.id);
            }
            marker.closePopup();
          };
        }
        if (reportBtn && onReportStop) {
          reportBtn.onclick = () => {
            onReportStop(stop.id);
            marker.closePopup();
          };
        }
      });

      markersRef.current[stop.id] = marker;
    });
  };

  // 4. Render Custom Origin & Destination Pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    // Origin Pin
    if (customPinsRef.current.origin) {
      customPinsRef.current.origin.remove();
      customPinsRef.current.origin = null;
    }
    if (originPoint && originPoint.type === 'custom') {
      const originIcon = L.divIcon({
        className: 'custom-origin-pin',
        html: `
          <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs animate-bounce ring-4 ring-emerald-500/30">
            🟢
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      customPinsRef.current.origin = L.marker([originPoint.lat, originPoint.lng], {
        icon: originIcon,
      })
        .bindPopup(`<b>Start Location:</b><br/>${originPoint.name}`)
        .addTo(map);
    }

    // Destination Pin
    if (customPinsRef.current.dest) {
      customPinsRef.current.dest.remove();
      customPinsRef.current.dest = null;
    }
    if (destPoint && destPoint.type === 'custom') {
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div class="w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs animate-bounce ring-4 ring-rose-500/30">
            🔴
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      customPinsRef.current.dest = L.marker([destPoint.lat, destPoint.lng], {
        icon: destIcon,
      })
        .bindPopup(`<b>Destination:</b><br/>${destPoint.name}`)
        .addTo(map);
    }
  }, [originPoint, destPoint]);

  // 5. Render GridPulse Safety Overlay (Geofence zones + Incident Pins)
  useEffect(() => {
    if (!mapInstanceRef.current || !safetyLayerGroupRef.current) return;
    safetyLayerGroupRef.current.clearLayers();

    if (!isSafetyVisible) return;

    // Add Geofence Zones
    DEFAULT_CAMPUS_ZONES.forEach(zone => {
      const polygon = L.polygon(zone.coords, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: zone.dangerLevel === 'hazard' ? 0.2 : 0.08,
        weight: 1.5,
        dashArray: zone.dangerLevel === 'hazard' ? '4, 4' : undefined,
      }).bindPopup(`<b>${zone.label}</b><br/>${zone.desc}`);

      safetyLayerGroupRef.current.addLayer(polygon);
    });

    // Add Incident Pins from reports
    reports.forEach(report => {
      const pin = reportToIncidentPin(report, stops);
      if (pin.status === 'resolved') return;

      const incIcon = L.divIcon({
        className: 'custom-hazard-pin',
        html: `
          <div class="w-6 h-6 rounded-full bg-rose-600 border border-white shadow-md flex items-center justify-center text-xs animate-pulse">
            ⚠️
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const incMarker = L.marker([pin.lat, pin.lng], { icon: incIcon }).bindPopup(`
        <div class="p-1 font-sans">
          <div class="font-bold text-xs text-rose-600">${pin.title}</div>
          <div class="text-[11px] text-slate-700">${pin.description || ''}</div>
          <div class="text-[10px] text-slate-500 mt-1">Severity: ${pin.severity.toUpperCase()}</div>
        </div>
      `);

      safetyLayerGroupRef.current.addLayer(incMarker);
    });
  }, [isSafetyVisible, reports, stops]);

  // 6. Render Route Polylines & Auto-Fit Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    if (!selectedRoute) return;

    const allPositions: [number, number][] = [];

    selectedRoute.polylines.forEach(poly => {
      const lineLayer = L.polyline(poly.positions, {
        color: poly.color,
        weight: poly.weight,
        dashArray: poly.dashArray || undefined,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routeLayersRef.current.push(lineLayer);
      poly.positions.forEach(p => allPositions.push(p));
    });

    if (allPositions.length > 0) {
      const bounds = L.latLngBounds(allPositions);
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16,
        animate: true,
      });
    }
  }, [selectedRoute]);

  // Address search query debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      const results = await GeocodingService.searchAddress(searchQuery, stops);
      setSearchResults(results);
      setIsSearching(false);
      setShowSearchDropdown(true);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, stops]);

  // GPS Locate Me Action
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current?.setView([latitude, longitude], 16);
        const address = await GeocodingService.reverseGeocode(latitude, longitude);

        if (onSelectOriginPoint) {
          onSelectOriginPoint({
            type: 'custom',
            name: `My GPS Location (${address})`,
            lat: latitude,
            lng: longitude,
            address,
            isGpsLocation: true,
          });
        }
      },
      err => {
        console.warn('Geolocation failed:', err);
        // Default to campus center for smooth test experience
        mapInstanceRef.current?.setView([42.365, -71.095], 16);
      }
    );
  };

  return (
    <div className="relative w-full h-full min-h-[480px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
      {/* Map DOM Element */}
      <div
        ref={mapContainerRef}
        className={`w-full h-full min-h-[480px] ${
          pickMode !== 'none' ? 'cursor-crosshair' : ''
        }`}
      />

      {/* Picking Mode Top Banner */}
      {pickMode !== 'none' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-emerald-900/95 border border-emerald-400 text-emerald-100 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center space-x-3 animate-pulse">
          <span className="text-lg font-bold">📍</span>
          <span className="text-xs font-bold">
            Tap anywhere on the map to set{' '}
            <span className="underline uppercase">{pickMode} location</span>
          </span>
          <button
            onClick={() => onSetPickMode?.('none')}
            className="px-2 py-0.5 rounded bg-black/40 text-[11px] font-semibold hover:bg-black/60"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Search Bar & Address Geocoding Overlay */}
      <div className="absolute top-4 left-4 z-20 w-72 sm:w-80 pointer-events-auto">
        <div className="relative">
          <div className="flex items-center bg-slate-900/95 border border-slate-700/90 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-md">
            <span className="text-slate-400 mr-2 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchDropdown(searchResults.length > 0)}
              placeholder="Search address, landmark, or stop..."
              className="bg-transparent border-none text-xs text-slate-100 placeholder-slate-400 focus:outline-none w-full"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                }}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md max-h-56 overflow-y-auto z-30 divide-y divide-slate-800">
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  className="p-2.5 hover:bg-slate-800/80 cursor-pointer text-xs transition-colors"
                >
                  <div
                    className="text-slate-200 font-semibold line-clamp-1"
                    onClick={() => {
                      mapInstanceRef.current?.setView([res.lat, res.lng], 16);
                      setShowSearchDropdown(false);
                    }}
                  >
                    {res.displayName}
                  </div>
                  <div className="flex items-center space-x-2 mt-1.5">
                    <button
                      onClick={() => {
                        onSelectOriginPoint?.({
                          type: 'custom',
                          name: res.displayName.split(',')[0],
                          lat: res.lat,
                          lng: res.lng,
                          address: res.displayName,
                        });
                        setShowSearchDropdown(false);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white"
                    >
                      Set Start
                    </button>
                    <button
                      onClick={() => {
                        onSelectDestPoint?.({
                          type: 'custom',
                          name: res.displayName.split(',')[0],
                          lat: res.lat,
                          lng: res.lng,
                          address: res.displayName,
                        });
                        setShowSearchDropdown(false);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white"
                    >
                      Set End
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Map Controls (Tile Layers + Safety Overlay + GPS) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Tile Layers Dropdown / Switcher */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-xl flex space-x-1">
          {(Object.keys(TILE_LAYERS) as TileLayerId[]).map(layerId => (
            <button
              key={layerId}
              onClick={() => setActiveTileLayer(layerId)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTileLayer === layerId
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {TILE_LAYERS[layerId].name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* GPS Locate Me Button & Safety Toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSafetyVisible(!isSafetyVisible)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md transition-colors flex items-center space-x-1 ${
              isSafetyVisible
                ? 'bg-rose-950/80 border-rose-600 text-rose-200'
                : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
            title="Toggle GridPulse Safety Overlay"
          >
            <span>🛡️</span>
            <span className="hidden sm:inline">Safety Layer</span>
          </button>

          <button
            onClick={handleLocateMe}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-emerald-400 shadow-xl backdrop-blur-md transition-colors"
            title="My Current Location (GPS)"
          >
            🎯
          </button>
        </div>
      </div>

      {/* Active Route Status Badge on Map */}
      {selectedRoute && (
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/95 backdrop-blur-md border border-emerald-500/80 rounded-xl p-3 shadow-xl max-w-sm pointer-events-auto">
          <div className="flex items-center space-x-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold text-white">Route: {selectedRoute.title}</span>
          </div>
          <p className="text-[11px] text-slate-300 line-clamp-1">{selectedRoute.summary}</p>
        </div>
      )}
    </div>
  );
};
