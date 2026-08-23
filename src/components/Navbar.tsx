import React from 'react';
import { UserPreferences } from '../types/transit';

export type NavigationTab =
  | 'home'
  | 'planner'
  | 'gridpulse'
  | 'ocr'
  | 'sync'
  | 'operator'
  | 'insights'
  | 'journey';

interface NavbarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onOpenPreferencesModal: () => void;
  onOpenReportModal: () => void;
  activeReportCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  preferences,
  onUpdatePreferences,
  onOpenPreferencesModal,
  onOpenReportModal,
  activeReportCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 glass-panel shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => onSelectTab('home')}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20 text-white font-bold text-xl ring-2 ring-emerald-400/30">
              <span>🦼</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-gradient-brand">
                  AccessRide
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  v2.0 Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Safe & Accessible Transit Navigator
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav
            className="hidden lg:flex items-center space-x-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80"
            aria-label="Main Navigation"
          >
            <button
              onClick={() => onSelectTab('home')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'home'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>🏠</span>
              <span>Home</span>
            </button>

            <button
              onClick={() => onSelectTab('planner')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'planner'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>🗺️</span>
              <span>Planner</span>
            </button>

            <button
              onClick={() => onSelectTab('gridpulse')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'gridpulse'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>🛡️</span>
              <span>GridPulse™</span>
            </button>

            <button
              onClick={() => onSelectTab('ocr')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'ocr'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>📷</span>
              <span>Scan & Report</span>
            </button>

            <button
              onClick={() => onSelectTab('sync')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'sync'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>🔄</span>
              <span>P2P Sync</span>
            </button>

            <button
              onClick={() => onSelectTab('operator')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'operator'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>🏢</span>
              <span>Operator</span>
              {activeReportCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                  {activeReportCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('insights')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'insights'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>🔮</span>
              <span>Insights</span>
            </button>
          </nav>

          {/* Quick Accessibility Controls & Preferences Trigger */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Quick Report Button */}
            <button
              onClick={onOpenReportModal}
              title="Report an issue, crowding, delay, or barrier"
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition"
            >
              <span>⚠️</span>
              <span className="hidden md:inline">Report Issue</span>
            </button>

            {/* Preferences Modal Button */}
            <button
              onClick={onOpenPreferencesModal}
              title="Customize Accessibility Preferences"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Preferences</span>
            </button>

            {/* High Contrast Toggle */}
            <button
              onClick={() => onUpdatePreferences({ highContrast: !preferences.highContrast })}
              title="Toggle WCAG AAA High Contrast Theme"
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                preferences.highContrast
                  ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <span>👁️</span>
              <span className="hidden xl:inline">{preferences.highContrast ? 'AAA On' : 'Contrast'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 border-t border-slate-800/80 gap-1 text-xs no-scrollbar">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'home' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            🏠 Home
          </button>
          <button
            onClick={() => onSelectTab('planner')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'planner' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            🗺️ Planner
          </button>
          <button
            onClick={() => onSelectTab('gridpulse')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'gridpulse' ? 'bg-rose-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            🛡️ GridPulse
          </button>
          <button
            onClick={() => onSelectTab('ocr')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'ocr' ? 'bg-teal-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            📷 OCR
          </button>
          <button
            onClick={() => onSelectTab('sync')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'sync' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            🔄 Sync
          </button>
          <button
            onClick={() => onSelectTab('operator')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'operator' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            🏢 Operator
          </button>
          <button
            onClick={() => onSelectTab('insights')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium ${
              currentTab === 'insights' ? 'bg-purple-600 text-white font-bold' : 'text-slate-300'
            }`}
          >
            🔮 Insights
          </button>
        </div>
      </div>
    </header>
  );
};
