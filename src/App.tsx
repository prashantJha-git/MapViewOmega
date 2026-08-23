import React, { useState, useEffect, useCallback } from 'react';
import type {
  UserPreferences,
  RouteCandidate,
  RouteSegment,
  TransitStop,
  TransitLine,
  QuickPreset,
  AccessibilityProfile,
  ProfileId,
  CommunityReport,
  FleetVehicle,
  TripPoint,
} from './types/transit';
import { TransitService } from './services/transitService';
import { DynamicRoutingEngine } from './services/dynamicRouting';
import { SpeechService } from './services/speechService';
import { Navbar, NavigationTab } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { RoutePlanner } from './components/RoutePlanner';
import { PreferenceModal } from './components/PreferenceModal';
import { RouteDetailModal } from './components/RouteDetailModal';
import { ReportModal } from './components/ReportModal';
import { OperatorDashboard } from './components/OperatorDashboard';
import { InsightsPanel } from './components/InsightsPanel';
import { JourneyMode } from './components/JourneyMode';
import { GridPulsePanel } from './features/gridpulse/GridPulsePanel';
import { ScanReportPanel } from './features/ocr/ScanReportPanel';
import { SyncPanel } from './features/sync/SyncPanel';
import { GlobalP2PService } from './features/sync/p2pService';
import { GlobalSyncStore } from './features/sync/syncStore';
import { playAlertTone } from './features/gridpulse/gridPulseEngine';

export const App: React.FC = () => {
  // Navigation
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');

  // Accessibility & Safety Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('accessride_preferences');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return TransitService.getProfileById('wheelchair').defaultPreferences;
  });

  // Modal Visibility
  const [isPrefModalOpen, setIsPrefModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportPreselectedStopId, setReportPreselectedStopId] = useState<string | undefined>(undefined);
  const [detailRoute, setDetailRoute] = useState<RouteCandidate | null>(null);
  const [broadcastBanner, setBroadcastBanner] = useState<{ title: string; message: string } | null>(null);
  const [activeJourneyRoute, setActiveJourneyRoute] = useState<RouteCandidate | null>(null);

  // Data & Routing State
  const [stops, setStops] = useState<TransitStop[]>([]);
  const [lines, setLines] = useState<TransitLine[]>([]);
  const [presets, setPresets] = useState<QuickPreset[]>([]);
  const [profiles, setProfiles] = useState<AccessibilityProfile[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);

  // Door-to-Door Trip Points (supports stops + custom coordinates / addresses)
  const [originPoint, setOriginPoint] = useState<TripPoint>({
    type: 'stop',
    id: 'stop_gate',
    name: 'West Campus Main Gate Hub',
    lat: 42.365,
    lng: -71.105,
  });

  const [destPoint, setDestPoint] = useState<TripPoint>({
    type: 'stop',
    id: 'stop_lib',
    name: 'Central Science Library & Quad',
    lat: 42.37,
    lng: -71.095,
  });

  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteCandidate | null>(null);

  // 1. Initial Data Load
  useEffect(() => {
    async function loadData() {
      const stopsData = await TransitService.getStops();
      const linesData = await TransitService.getLines();
      setStops(stopsData);
      setLines(linesData);
      setPresets(TransitService.getQuickPresets());
      setProfiles(TransitService.getProfiles());
      setReports(TransitService.getCommunityReports());
      setFleet(TransitService.getFleetVehicles());
    }
    loadData();
  }, []);

  // 2. High Contrast, Font Scaling & Speech Side Effects
  useEffect(() => {
    // High contrast class
    if (preferences.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // Font size scaling class
    document.documentElement.classList.remove('font-scale-large', 'font-scale-xlarge');
    if (preferences.fontSize === 'large') {
      document.documentElement.classList.add('font-scale-large');
    } else if (preferences.fontSize === 'xlarge') {
      document.documentElement.classList.add('font-scale-xlarge');
    }

    // Speech service sync
    SpeechService.setEnabled(preferences.voiceAnnouncements);

    // Save preferences to localStorage and sync store
    localStorage.setItem('accessride_preferences', JSON.stringify(preferences));
    GlobalSyncStore.updatePreferences(preferences);
  }, [preferences]);

  // 3. Listen for Incoming P2P Emergency SOS Beacons
  useEffect(() => {
    const unsubSos = GlobalP2PService.onSosReceived(sos => {
      playAlertTone('critical');
      setBroadcastBanner({
        title: `🚨 P2P EMERGENCY SOS BEACON (${sos.senderName})`,
        message: `${sos.message} [Time: ${sos.timestamp}]`,
      });
      SpeechService.speak(`Emergency alert received from paired device: ${sos.senderName}.`);
    });

    return () => {
      unsubSos();
    };
  }, []);

  // 4. Dynamic Route Calculation Routine (Handles any custom lat/lng or stops)
  const runRouteCalculation = useCallback(
    async (from: TripPoint, to: TripPoint, prefs: UserPreferences, currentStops: TransitStop[]) => {
      if (!from || !to) {
        setRoutes([]);
        setSelectedRoute(null);
        return;
      }

      if (from.type === 'stop' && to.type === 'stop' && from.id === to.id) {
        setRoutes([]);
        setSelectedRoute(null);
        return;
      }

      const calculated = await DynamicRoutingEngine.calculateDynamicRoutes(
        from,
        to,
        prefs,
        currentStops
      );
      setRoutes(calculated);

      if (calculated.length > 0) {
        setSelectedRoute(calculated[0]);
        if (prefs.voiceAnnouncements) {
          SpeechService.speak(
            `Calculated ${calculated.length} routes. Top recommendation is ${calculated[0].title}. Total travel time: ${calculated[0].totalDurationMin} minutes.`
          );
        }
      } else {
        setSelectedRoute(null);
      }
    },
    []
  );

  // Recalculate routes whenever origin, dest, preferences, or stops change
  useEffect(() => {
    if (stops.length > 0) {
      runRouteCalculation(originPoint, destPoint, preferences, stops);
    }
  }, [originPoint, destPoint, preferences, stops, runRouteCalculation]);

  // Handlers
  const handleUpdatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updates };
      return next;
    });
  };

  const handleSelectProfile = (profileId: ProfileId) => {
    const prof = TransitService.getProfileById(profileId);
    const updated: UserPreferences = {
      ...prof.defaultPreferences,
      highContrast: preferences.highContrast,
      fontSize: preferences.fontSize,
      voiceAnnouncements: preferences.voiceAnnouncements,
    };
    setPreferences(updated);
    if (preferences.voiceAnnouncements) {
      SpeechService.speak(`Accessibility profile switched to ${prof.name}.`);
    }
  };

  const handleSelectPreset = (preset: QuickPreset) => {
    const originStop = stops.find(s => s.id === preset.originId);
    const destStop = stops.find(s => s.id === preset.destId);

    if (originStop && destStop) {
      setOriginPoint({
        type: 'stop',
        id: originStop.id,
        name: originStop.name,
        lat: originStop.lat,
        lng: originStop.lng,
      });
      setDestPoint({
        type: 'stop',
        id: destStop.id,
        name: destStop.name,
        lat: destStop.lat,
        lng: destStop.lng,
      });
    }
    setCurrentTab('planner');
    if (preferences.voiceAnnouncements) {
      SpeechService.speak(`Loading preset route for ${preset.title}.`);
    }
  };

  const handleSwapLocations = () => {
    const temp = originPoint;
    setOriginPoint(destPoint);
    setDestPoint(temp);
  };

  // Start Journey Mode
  const handleStartJourney = (route: RouteCandidate) => {
    setActiveJourneyRoute(route);
    GlobalSyncStore.updateActiveJourney(route);
    setCurrentTab('journey');
  };

  const handleCompleteJourney = () => {
    setActiveJourneyRoute(null);
    GlobalSyncStore.updateActiveJourney(null);
    setCurrentTab('planner');
  };

  const handleExitJourney = () => {
    setActiveJourneyRoute(null);
    GlobalSyncStore.updateActiveJourney(null);
    setCurrentTab('planner');
  };

  // Open Report Modal
  const handleOpenReport = (stopId?: string) => {
    setReportPreselectedStopId(stopId);
    setIsReportModalOpen(true);
  };

  // Handle new report submission
  const handleReportSubmitted = async (
    newReportData: Omit<CommunityReport, 'id' | 'timestamp' | 'upvotes' | 'status'>
  ) => {
    const updatedReports = TransitService.addCommunityReport(newReportData);
    setReports([...updatedReports]);

    const refreshedStops = await TransitService.getStops();
    setStops([...refreshedStops]);

    runRouteCalculation(originPoint, destPoint, preferences, refreshedStops);
  };

  // Operator Resolve Report
  const handleResolveReport = async (reportId: string, note?: string) => {
    const updatedReports = TransitService.resolveCommunityReport(reportId, note);
    setReports([...updatedReports]);

    const refreshedStops = await TransitService.getStops();
    setStops([...refreshedStops]);

    runRouteCalculation(originPoint, destPoint, preferences, refreshedStops);
  };

  // Upvote Report
  const handleUpvoteReport = (reportId: string) => {
    const updatedReports = TransitService.upvoteCommunityReport(reportId);
    setReports([...updatedReports]);
  };

  // Update Fleet Telemetry
  const handleUpdateVehicle = (vehicleId: string, updates: Partial<FleetVehicle>) => {
    const updatedFleet = TransitService.updateFleetVehicle(vehicleId, updates);
    setFleet([...updatedFleet]);
  };

  // Emergency Escalation
  const handleTriggerEmergencyEscalation = (route: RouteCandidate, step: RouteSegment) => {
    const escalationReport: Omit<CommunityReport, 'id' | 'timestamp' | 'upvotes' | 'status'> = {
      stopId: step.fromStopId || 'stop_lib',
      stopName: step.fromName || 'University Central Library Hub',
      lineId: step.line?.id || 'line_shuttle',
      lineName: step.line?.name || 'SafeCorridor Campus Night Shuttle',
      type: 'sos_alert',
      category: 'Safety Emergency',
      severity: 'critical',
      title: '🚨 MISSED CHECK-IN SOS: Passenger Alert (Alex Rivera)',
      details: `Automated 2-Tier Escalation: Passenger failed to respond to safety check-in warning near ${step.fromName}. Trusted emergency contacts notified. Immediate campus security escort dispatch requested.`,
      impact: 'Cruiser #12 dispatched (Officer J. Miller). Monitored via Operator Command Desk.',
    };
    const updated = TransitService.addCommunityReport(escalationReport);
    setReports([...updated]);
    setBroadcastBanner({
      title: '🚨 EMERGENCY ESCALATION ALERT',
      message: `Automated safety escort cruiser dispatched to ${step.fromName} for passenger Alex Rivera.`,
    });
  };

  const handleBroadcastAlert = (title: string, message: string) => {
    setBroadcastBanner({ title, message });
    setTimeout(() => {
      setBroadcastBanner(null);
    }, 8000);
  };

  const activeReportsCount = reports.filter(r => r.status !== 'resolved').length;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Global Shell Navigation */}
      <Navbar
        currentTab={currentTab === 'journey' ? 'planner' : currentTab}
        onSelectTab={tab => {
          if (currentTab === 'journey') {
            setActiveJourneyRoute(null);
          }
          setCurrentTab(tab);
        }}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        onOpenPreferencesModal={() => setIsPrefModalOpen(true)}
        onOpenReportModal={() => handleOpenReport()}
        activeReportCount={activeReportsCount}
      />

      {/* Global Broadcast Advisory Banner (if active) */}
      {broadcastBanner && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-slate-950 px-4 py-2.5 shadow-lg border-b border-amber-400 font-bold text-xs sm:text-sm flex items-center justify-between animate-fadeIn z-30">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📢</span>
              <span>
                <strong>{broadcastBanner.title}:</strong> {broadcastBanner.message}
              </span>
            </div>
            <button
              onClick={() => setBroadcastBanner(null)}
              className="ml-4 text-slate-950 hover:text-white font-black px-2 py-0.5 rounded bg-black/10 hover:bg-black/20 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        {currentTab === 'journey' && activeJourneyRoute ? (
          <JourneyMode
            route={activeJourneyRoute}
            preferences={preferences}
            onCompleteJourney={handleCompleteJourney}
            onExitJourney={handleExitJourney}
            onOpenReportModal={() => handleOpenReport()}
            onTriggerEmergencyEscalation={handleTriggerEmergencyEscalation}
            voiceEnabled={preferences.voiceAnnouncements}
          />
        ) : currentTab === 'home' ? (
          <HomeScreen
            profiles={profiles}
            stops={stops}
            presets={presets}
            preferences={preferences}
            reports={reports}
            onSelectProfile={handleSelectProfile}
            onSelectPreset={handleSelectPreset}
            onStartPlanning={() => setCurrentTab('planner')}
            onOpenPreferencesModal={() => setIsPrefModalOpen(true)}
            onOpenReportModal={() => handleOpenReport()}
            onUpvoteReport={handleUpvoteReport}
          />
        ) : currentTab === 'planner' ? (
          <RoutePlanner
            stops={stops}
            presets={presets}
            originPoint={originPoint}
            destPoint={destPoint}
            onChangeOriginPoint={setOriginPoint}
            onChangeDestPoint={setDestPoint}
            onSwapLocations={handleSwapLocations}
            onSelectPreset={handleSelectPreset}
            routes={routes}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            onOpenDetails={setDetailRoute}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onOpenPreferencesModal={() => setIsPrefModalOpen(true)}
            onOpenReportModal={() => handleOpenReport()}
            onReportStop={stopId => handleOpenReport(stopId)}
            onStartJourney={handleStartJourney}
            reports={reports}
          />
        ) : currentTab === 'gridpulse' ? (
          <GridPulsePanel
            reports={reports}
            stops={stops}
            onResolveReport={handleResolveReport}
            onAddNewReport={handleOpenReport}
          />
        ) : currentTab === 'ocr' ? (
          <ScanReportPanel
            stops={stops}
            onApplyReport={async rep => {
              if (rep.title && rep.type && rep.severity) {
                await handleReportSubmitted(rep as any);
                setCurrentTab('gridpulse');
              }
            }}
          />
        ) : currentTab === 'sync' ? (
          <SyncPanel
            onNavigateRoute={(orig, dst) => {
              setOriginPoint(orig);
              setDestPoint(dst);
              setCurrentTab('planner');
            }}
            onSosBroadcast={msg => {
              setBroadcastBanner({
                title: '🚨 LOCAL EMERGENCY SOS BROADCAST',
                message: msg,
              });
            }}
          />
        ) : currentTab === 'insights' ? (
          <InsightsPanel stops={stops} lines={lines} />
        ) : (
          <OperatorDashboard
            fleet={fleet}
            reports={reports}
            stops={stops}
            lines={lines}
            onResolveReport={handleResolveReport}
            onUpdateVehicle={handleUpdateVehicle}
            onBroadcastAlert={handleBroadcastAlert}
            onOpenReportModal={() => handleOpenReport()}
            voiceEnabled={preferences.voiceAnnouncements}
          />
        )}
      </main>

      {/* 3. Accessibility Preference Selection Modal */}
      <PreferenceModal
        isOpen={isPrefModalOpen}
        onClose={() => setIsPrefModalOpen(false)}
        preferences={preferences}
        onSavePreferences={newPrefs => setPreferences(newPrefs)}
      />

      {/* 4. Community Barrier & Hazard Reporting Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        stops={stops}
        lines={lines}
        preselectedStopId={reportPreselectedStopId}
        onReportSubmitted={handleReportSubmitted}
        voiceEnabled={preferences.voiceAnnouncements}
      />

      {/* 5. Turn-by-Turn Itinerary Breakdown Modal */}
      <RouteDetailModal
        route={detailRoute}
        onClose={() => setDetailRoute(null)}
        onStartJourney={handleStartJourney}
      />

      {/* 6. Accessible Footer */}
      <footer className="bg-slate-900 border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span>🦼 AccessRide Navigator Pro</span>
            <span>•</span>
            <span>WCAG 2.1 AAA Compliant Design System</span>
          </div>
          <p>Prioritizing dignity, safe lit corridors, and 100% barrier-free transit for all passengers.</p>
        </div>
      </footer>
    </div>
  );
};
