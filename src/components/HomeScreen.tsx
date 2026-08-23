import React from 'react';
import {
  AccessibilityProfile,
  TransitStop,
  QuickPreset,
  UserPreferences,
  ProfileId,
  CommunityReport,
} from '../types/transit';

interface HomeScreenProps {
  profiles: AccessibilityProfile[];
  stops: TransitStop[];
  presets: QuickPreset[];
  preferences: UserPreferences;
  reports: CommunityReport[];
  onSelectProfile: (profileId: ProfileId) => void;
  onSelectPreset: (preset: QuickPreset) => void;
  onStartPlanning: () => void;
  onOpenPreferencesModal: () => void;
  onOpenReportModal: () => void;
  onUpvoteReport: (reportId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profiles,
  stops,
  presets,
  preferences,
  reports,
  onSelectProfile,
  onSelectPreset,
  onStartPlanning,
  onOpenPreferencesModal,
  onOpenReportModal,
  onUpvoteReport,
}) => {
  const currentProfile = profiles.find(p => p.id === preferences.profileId) || profiles[0];

  // Data (profiles, stops, etc.) loads asynchronously in App.tsx and is empty
  // on the very first render, so bail out early to avoid crashing on
  // currentProfile being undefined.
  if (!currentProfile) {
    return (
      <div className="space-y-6 pb-16 animate-fadeIn" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading accessibility profiles…</span>
        <div className="h-56 rounded-3xl skeleton-shimmer border border-slate-800/80" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer border border-slate-800/80" />
          ))}
        </div>
        <div className="h-40 rounded-2xl skeleton-shimmer border border-slate-800/80" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16 animate-fadeIn">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
        {/* Glow background decorations */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="animate-pulse">●</span>
            <span>Safer & Dignified Transit Navigator</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            Navigate your city with{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
              confidence, safety & zero barriers
            </span>
            .
          </h1>

          <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
            AccessRide prioritizes <strong>your accessibility and safety needs</strong> over pure speed.
            Discover verified 100% step-free pathways, avoid broken elevators and stairs, and travel along
            illuminated corridors with emergency SOS protection.
          </p>

          {/* Call to action buttons */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              id="heroPlanTripBtn"
              onClick={onStartPlanning}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 flex items-center space-x-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>🗺️ Plan an Accessible Journey</span>
              <span>➔</span>
            </button>

            <button
              onClick={onOpenPreferencesModal}
              className="px-4 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-sm border border-slate-700 transition"
            >
              <span>⚙️ Customize Mobility Needs</span>
            </button>

            <button
              onClick={onOpenReportModal}
              className="px-4 py-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 font-bold text-sm border border-amber-500/40 transition flex items-center space-x-1.5"
            >
              <span>⚠️</span>
              <span>Report Barrier / Delay</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Interactive Profile Selector Card */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Step 1: Choose Your Needs
            </span>
            <h2 className="text-2xl font-black text-white">How would you like to travel today?</h2>
          </div>
          <button
            onClick={onOpenPreferencesModal}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline self-start sm:self-auto"
          >
            Adjust Granular Filters &gt;
          </button>
        </div>

        {/* Profile Chips Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {profiles.map(p => {
            const isSelected = preferences.profileId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectProfile(p.id)}
                className={`p-4 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${
                  isSelected
                    ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/50'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <span className="text-3xl">{p.icon}</span>
                <span
                  className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-emerald-300' : 'text-slate-200'}`}
                >
                  {p.name}
                </span>
                <span className="text-[10px] text-slate-400 line-clamp-1">{p.tagline}</span>
              </button>
            );
          })}
        </div>

        {/* Active Profile Info Banner */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{currentProfile.icon}</span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">Active Profile: {currentProfile.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                  {currentProfile.tagline}
                </span>
              </div>
              <p className="text-xs text-slate-400">{currentProfile.description}</p>
            </div>
          </div>
          <button
            onClick={onStartPlanning}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition"
          >
            Find Routes with this Profile ➔
          </button>
        </div>
      </section>

      {/* 3. Popular Route Presets */}
      <section>
        <div className="mb-4">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Quick Demos & Popular Routes
          </span>
          <h3 className="text-xl font-bold text-white">Explore Common Accessible Routes</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {presets.map(preset => (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/60 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/40 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center space-x-2 text-2xl mb-2">
                  <span>{preset.icon}</span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition mb-1">
                  {preset.title}
                </h4>
                <p className="text-xs text-slate-400 mb-3">{preset.description}</p>
              </div>
              <div className="flex items-center text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 pt-2 border-t border-slate-800">
                <span>View Ranked Routes</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Core Feature Pillars */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-2xl mb-4 text-emerald-400">
            🦼
          </div>
          <h4 className="text-base font-bold text-white mb-2">100% Step-Free Validation</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Guarantees routes with electric low-floor vehicle ramps, ADA curb ramps, and verified elevator
            access to eliminate unexpected physical barriers.
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-800 flex items-center justify-center text-2xl mb-4 text-blue-400">
            🛡️
          </div>
          <h4 className="text-base font-bold text-white mb-2">Safe Lit Corridors</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Routes scored by lighting intensity (up to 10/10), active CCTV coverage, 24/7 Blue-Light SOS
            kiosks, and security escort services.
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-800 flex items-center justify-center text-2xl mb-4 text-amber-400">
            🧠
          </div>
          <h4 className="text-base font-bold text-white mb-2">Transparent Route AI</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Plain-English explanations for every route choice. Understand exactly why a route was recommended
            and what tradeoffs it avoids.
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-2xl mb-4 text-red-400">
            🛗
          </div>
          <h4 className="text-base font-bold text-white mb-2">Barrier Hazard Avoidance</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automatically reroutes around out-of-service elevators, steep stair-only concourses, cobblestone
            vibration zones, and high-rush crowds.
          </p>
        </div>
      </section>

      {/* 5. Live Community Transit Pulse & Barrier Reports Feed */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Crowdsource Intelligence
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                Live Field Feed
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              Live Passenger Barrier & Transit Pulse Alerts
            </h3>
            <p className="text-xs text-slate-400">
              Real-time reports from fellow passengers. Directly fed into dispatch & routing.
            </p>
          </div>

          <button
            onClick={onOpenReportModal}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 transition flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <span>⚠️</span>
            <span>Report a Transit Barrier</span>
          </button>
        </div>

        {/* Reports Feed Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.slice(0, 6).map(r => {
            const isBarrier = r.category === 'Accessibility Barrier';
            const isCrowd = r.category === 'Crowding';
            const isDelay = r.category === 'Transit Delay';
            const isResolved = r.status === 'resolved';

            return (
              <div
                key={r.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                  isResolved
                    ? 'bg-slate-950/60 border-slate-800/80 opacity-70'
                    : isBarrier
                      ? 'bg-red-950/20 border-red-900/50 hover:border-red-700/80'
                      : isCrowd
                        ? 'bg-purple-950/20 border-purple-900/50 hover:border-purple-700/80'
                        : isDelay
                          ? 'bg-amber-950/20 border-amber-900/50 hover:border-amber-700/80'
                          : 'bg-emerald-950/20 border-emerald-900/50 hover:border-emerald-700/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isBarrier
                          ? 'bg-red-950/80 text-red-300 border-red-800'
                          : isCrowd
                            ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                            : isDelay
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {r.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">⏱️ {r.timestamp}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1">{r.title}</h4>
                  <p className="text-xs text-slate-300 mb-3 line-clamp-2">{r.details}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[170px]">
                    <strong>Impact:</strong> {r.impact}
                  </span>
                  <button
                    onClick={() => onUpvoteReport(r.id)}
                    className="px-2.5 py-1 rounded-lg font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1"
                    title="Mark this report as verified / helpful"
                  >
                    <span>👍</span>
                    <span>{r.upvotes}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Live Transit Hubs Status Grid */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Network Transparency
            </span>
            <h3 className="text-xl font-bold text-white">Live Station & Transit Hubs Status</h3>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Step-Free</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              <span>Barrier Alert</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stops.map(stop => (
            <div
              key={stop.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {stop.zone}
                  </span>
                  <h4 className="text-sm font-bold text-white">{stop.name}</h4>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {stop.code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-3 text-[11px]">
                {/* Step free */}
                <div
                  className={`px-2 py-1 rounded flex items-center space-x-1.5 font-semibold ${
                    stop.stepFree
                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
                      : 'bg-red-950/70 text-red-300 border border-red-800/50'
                  }`}
                >
                  <span>{stop.stepFree ? '✓' : '⚠️'}</span>
                  <span>{stop.stepFree ? 'Step-Free' : 'Has Stairs'}</span>
                </div>

                {/* Lighting */}
                <div className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 flex items-center space-x-1.5">
                  <span>💡</span>
                  <span>Light: {stop.lightingScore}/10</span>
                </div>

                {/* Elevator */}
                <div
                  className={`px-2 py-1 rounded flex items-center space-x-1.5 font-medium ${
                    stop.elevatorStatus === 'operational'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900'
                      : stop.elevatorStatus === 'broken'
                        ? 'bg-red-950/70 text-red-300 border border-red-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span>🛗</span>
                  <span>Elev: {stop.elevatorStatus}</span>
                </div>

                {/* Crowds */}
                <div className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1.5">
                  <span>👥</span>
                  <span className="capitalize">{stop.crowdLevel} crowd</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-2">{stop.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};