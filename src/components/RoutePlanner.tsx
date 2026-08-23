import React, { useState } from 'react';
import {
  TransitStop,
  RouteCandidate,
  UserPreferences,
  QuickPreset,
  TripPoint,
  PickPointMode,
  CommunityReport,
} from '../types/transit';
import { RouteCard } from './RouteCard';
import { MapView } from './MapView';
import { GlobalSyncStore } from '../features/sync/syncStore';

interface RoutePlannerProps {
  stops: TransitStop[];
  presets: QuickPreset[];
  originPoint: TripPoint;
  destPoint: TripPoint;
  onChangeOriginPoint: (point: TripPoint) => void;
  onChangeDestPoint: (point: TripPoint) => void;
  onSwapLocations: () => void;
  onSelectPreset: (preset: QuickPreset) => void;
  routes: RouteCandidate[];
  selectedRoute: RouteCandidate | null;
  onSelectRoute: (route: RouteCandidate) => void;
  onOpenDetails: (route: RouteCandidate) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onOpenPreferencesModal: () => void;
  onOpenReportModal?: () => void;
  onReportStop?: (stopId: string) => void;
  onStartJourney?: (route: RouteCandidate) => void;
  reports?: CommunityReport[];
}

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  stops,
  presets,
  originPoint,
  destPoint,
  onChangeOriginPoint,
  onChangeDestPoint,
  onSwapLocations,
  onSelectPreset,
  routes,
  selectedRoute,
  onSelectRoute,
  onOpenDetails,
  preferences,
  onUpdatePreferences,
  onOpenPreferencesModal,
  onOpenReportModal,
  onReportStop,
  onStartJourney,
  reports = [],
}) => {
  const [pickMode, setPickMode] = useState<PickPointMode>('none');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleOriginStopChange = (stopId: string) => {
    const matched = stops.find(s => s.id === stopId);
    if (matched) {
      onChangeOriginPoint({
        type: 'stop',
        id: matched.id,
        name: matched.name,
        lat: matched.lat,
        lng: matched.lng,
      });
    }
  };

  const handleDestStopChange = (stopId: string) => {
    const matched = stops.find(s => s.id === stopId);
    if (matched) {
      onChangeDestPoint({
        type: 'stop',
        id: matched.id,
        name: matched.name,
        lat: matched.lat,
        lng: matched.lng,
      });
    }
  };

  const handleSaveCurrentRoute = () => {
    if (!selectedRoute) return;
    GlobalSyncStore.addSavedRoute({
      title: `${originPoint.name} ➔ ${destPoint.name}`,
      origin: originPoint,
      destination: destPoint,
      profileId: preferences.profileId,
      notes: `${selectedRoute.title} (${selectedRoute.totalDurationMin} min)`,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* 1. Trip Search Card & Preferences Quick Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        {/* Active Profile & Quick Filter Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Needs:</span>
            <button
              onClick={onOpenPreferencesModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900 transition"
              title="Click to customize profile"
            >
              <span>♿</span>
              <span className="capitalize">{preferences.profileId.replace('_', ' ')} Profile</span>
              <span className="text-[10px] opacity-70">✏️</span>
            </button>
          </div>

          {/* Quick toggle chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => onUpdatePreferences({ stepFreeOnly: !preferences.stepFreeOnly })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition border ${
                preferences.stepFreeOnly
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              🦼 Step-Free: {preferences.stepFreeOnly ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => onUpdatePreferences({ avoidStairs: !preferences.avoidStairs })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition border ${
                preferences.avoidStairs
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              🪜 Avoid Stairs: {preferences.avoidStairs ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => onUpdatePreferences({ preferSaferRoute: !preferences.preferSaferRoute })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition border ${
                preferences.preferSaferRoute
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              🛡️ Safer Route: {preferences.preferSaferRoute ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => onUpdatePreferences({ avoidCrowded: !preferences.avoidCrowded })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition border ${
                preferences.avoidCrowded
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              👥 Avoid Crowds: {preferences.avoidCrowded ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={onOpenPreferencesModal}
              className="px-2.5 py-1 rounded-lg font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
            >
              ⚙️ More Filters...
            </button>
          </div>
        </div>

        {/* Origin & Destination Inputs with Map Pick Triggers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Origin Selector / Custom Pin Display */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1">
                <span className="text-emerald-400">📍</span>
                <span>Starting Point</span>
              </label>

              <button
                type="button"
                onClick={() => setPickMode(pickMode === 'origin' ? 'none' : 'origin')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors flex items-center space-x-1 ${
                  pickMode === 'origin'
                    ? 'bg-emerald-600 text-white border-emerald-400 animate-pulse'
                    : 'bg-slate-800 text-emerald-300 border-emerald-700/60 hover:bg-slate-700'
                }`}
              >
                <span>🗺️ Pick on Map</span>
              </button>
            </div>

            {originPoint.type === 'custom' ? (
              <div className="flex items-center justify-between bg-slate-950 border border-emerald-500/80 rounded-xl px-3 py-2 text-xs text-white">
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-emerald-400">🟢</span>
                  <span className="font-semibold truncate">{originPoint.name}</span>
                </div>
                <button
                  onClick={() => handleOriginStopChange('stop_gate')}
                  className="text-slate-400 hover:text-white text-[11px] underline ml-2 shrink-0"
                >
                  Change to Stop
                </button>
              </div>
            ) : (
              <select
                value={originPoint.id || ''}
                onChange={e => handleOriginStopChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              >
                <option value="">Select origin stop...</option>
                {stops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.stepFree ? '✓ Step-Free' : '⚠️ Has Stairs'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Swap Button */}
          <div className="md:col-span-2 flex justify-center pb-0.5">
            <button
              type="button"
              id="swapLocationsBtn"
              onClick={onSwapLocations}
              title="Swap Origin and Destination"
              className="w-full md:w-12 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-sm transition shadow"
            >
              ⇄ <span className="md:hidden ml-2">Swap Locations</span>
            </button>
          </div>

          {/* Destination Selector / Custom Pin Display */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1">
                <span className="text-blue-400">🏁</span>
                <span>Destination</span>
              </label>

              <button
                type="button"
                onClick={() => setPickMode(pickMode === 'destination' ? 'none' : 'destination')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors flex items-center space-x-1 ${
                  pickMode === 'destination'
                    ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
                    : 'bg-slate-800 text-blue-300 border-blue-700/60 hover:bg-slate-700'
                }`}
              >
                <span>🗺️ Pick on Map</span>
              </button>
            </div>

            {destPoint.type === 'custom' ? (
              <div className="flex items-center justify-between bg-slate-950 border border-blue-500/80 rounded-xl px-3 py-2 text-xs text-white">
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-blue-400">🔴</span>
                  <span className="font-semibold truncate">{destPoint.name}</span>
                </div>
                <button
                  onClick={() => handleDestStopChange('stop_lib')}
                  className="text-slate-400 hover:text-white text-[11px] underline ml-2 shrink-0"
                >
                  Change to Stop
                </button>
              </div>
            ) : (
              <select
                value={destPoint.id || ''}
                onChange={e => handleDestStopChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              >
                <option value="">Select destination stop...</option>
                {stops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.stepFree ? '✓ Step-Free' : '⚠️ Has Stairs'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Quick Presets Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="text-slate-400 font-semibold">Quick Presets:</span>
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`px-3 py-1 rounded-lg font-medium border transition ${
                originPoint.id === preset.originId && destPoint.id === preset.destId
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main Split Content: Route Results & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Route Options List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Ranked Door-to-Door Routes</h3>
              <p className="text-xs text-slate-400">
                Door-to-door multi-modal routes with first/last mile OSRM walking paths
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {selectedRoute && (
                <button
                  onClick={handleSaveCurrentRoute}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-600/40 transition-colors"
                >
                  {saveSuccess ? '✓ Route Saved!' : '⭐ Sync Route'}
                </button>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {routes.length} Options
              </span>
            </div>
          </div>

          {/* List of Route Cards */}
          <div className="space-y-4">
            {routes.map(route => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={selectedRoute?.id === route.id}
                preferences={preferences}
                onSelectRoute={onSelectRoute}
                onOpenDetails={onOpenDetails}
                onStartJourney={onStartJourney}
              />
            ))}

            {routes.length === 0 && (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-3xl block mb-2">🔍</span>
                <h4 className="text-sm font-bold text-white">No routes found</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Please tap locations on the map or select stops from the controls above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Leaflet Map */}
        <div className="lg:col-span-6 lg:sticky lg:top-20">
          <MapView
            stops={stops}
            selectedRoute={selectedRoute}
            originPoint={originPoint}
            destPoint={destPoint}
            onSelectOriginPoint={onChangeOriginPoint}
            onSelectDestPoint={onChangeDestPoint}
            pickMode={pickMode}
            onSetPickMode={setPickMode}
            onReportStop={onReportStop}
            reports={reports}
          />
        </div>
      </div>
    </div>
  );
};
