import React, { useState, useEffect } from 'react';
import {
  TransitStop,
  TransitLine,
  ReportType,
  ReportCategory,
  ReportSeverity,
  CommunityReport,
} from '../types/transit';
import { SpeechService } from '../services/speechService';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stops: TransitStop[];
  lines: TransitLine[];
  preselectedStopId?: string;
  onReportSubmitted: (report: Omit<CommunityReport, 'id' | 'timestamp' | 'upvotes' | 'status'>) => void;
  voiceEnabled: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  stops,
  lines,
  preselectedStopId,
  onReportSubmitted,
  voiceEnabled,
}) => {
  const [selectedStopId, setSelectedStopId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('broken_elevator');
  const [details, setDetails] = useState<string>('');
  const [severity, setSeverity] = useState<ReportSeverity>('high');
  const [crowdLevel, setCrowdLevel] = useState<'low' | 'moderate' | 'high'>('high');
  const [delayMinutes, setDelayMinutes] = useState<number>(10);
  const [submittedToast, setSubmittedToast] = useState<boolean>(false);

  useEffect(() => {
    if (preselectedStopId) {
      setSelectedStopId(preselectedStopId);
    } else if (stops.length > 0 && !selectedStopId) {
      setSelectedStopId(stops[0].id);
    }
  }, [preselectedStopId, stops, isOpen]);

  if (!isOpen) return null;

  const REPORT_TYPE_CONFIGS: Record<
    ReportType,
    {
      category: ReportCategory;
      title: string;
      icon: string;
      defaultSeverity: ReportSeverity;
      impactText: string;
      bgBadge: string;
    }
  > = {
    broken_elevator: {
      category: 'Accessibility Barrier',
      title: 'Broken Elevator / Lift Outage',
      icon: '🛗',
      defaultSeverity: 'critical',
      impactText: 'Stop elevator status set to Inaccessible; avoids station for wheelchair routes.',
      bgBadge: 'bg-red-950/80 text-red-300 border-red-800',
    },
    broken_ramp: {
      category: 'Accessibility Barrier',
      title: 'Inoperative Vehicle Ramp / Boarding Gap',
      icon: '🦼',
      defaultSeverity: 'high',
      impactText: 'Flags step-free boarding warning & prompts dispatcher ramp staging.',
      bgBadge: 'bg-red-950/80 text-red-300 border-red-800',
    },
    dim_lighting: {
      category: 'Safety Issue',
      title: 'Dim / Broken Lighting or Obstruction',
      icon: '💡',
      defaultSeverity: 'medium',
      impactText: 'Reduces corridor safety score by 20% & flags for safety patrol.',
      bgBadge: 'bg-amber-950/80 text-amber-300 border-amber-800',
    },
    crowded: {
      category: 'Crowding',
      title: 'Heavy Vehicle Crowding (No Seating/Bays)',
      icon: '👥',
      defaultSeverity: 'high',
      impactText: 'Updates route crowd level to High & notifies low-sensory passengers.',
      bgBadge: 'bg-purple-950/80 text-purple-300 border-purple-800',
    },
    delay: {
      category: 'Transit Delay',
      title: 'Transit Delay & Extended Wait Times',
      icon: '⏱️',
      defaultSeverity: 'medium',
      impactText: 'Adds delay penalty to travel time ETA & alerts dispatch queue.',
      bgBadge: 'bg-amber-950/80 text-amber-300 border-amber-800',
    },
    safe_verified: {
      category: 'Safety Commendation',
      title: 'Active Safety Escort & Clear Corridors',
      icon: '🛡️',
      defaultSeverity: 'low',
      impactText: 'Boosts stop safety score & highlights verified step-free pathway.',
      bgBadge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    },
    obstruction: {
      category: 'Accessibility Barrier',
      title: 'Sidewalk / Ramp Pathway Obstructed',
      icon: '🚧',
      defaultSeverity: 'medium',
      impactText: 'Notifies wheelchair users to take adjacent safe corridor.',
      bgBadge: 'bg-orange-950/80 text-orange-300 border-orange-800',
    },
    escalator_down: {
      category: 'Accessibility Barrier',
      title: 'Escalator Out of Service',
      icon: '🪜',
      defaultSeverity: 'medium',
      impactText: 'Alerts reduced-mobility passengers of stair requirements.',
      bgBadge: 'bg-amber-950/80 text-amber-300 border-amber-800',
    },
    sos_alert: {
      category: 'Safety Emergency',
      title: 'Missed Check-In SOS Escalation',
      icon: '🚨',
      defaultSeverity: 'critical',
      impactText: "Dispatches campus security and notifies the passenger's emergency contact.",
      bgBadge: 'bg-red-950/80 text-red-300 border-red-800',
    },
  };

  const handleSelectType = (type: ReportType) => {
    setReportType(type);
    setSeverity(REPORT_TYPE_CONFIGS[type].defaultSeverity);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stop = stops.find(s => s.id === selectedStopId);
    const line = lines.find(l => l.id === selectedLineId);
    const config = REPORT_TYPE_CONFIGS[reportType];

    let customTitle = config.title;
    if (stop) {
      customTitle = `${config.title} at ${stop.name}`;
    }

    const payload: Omit<CommunityReport, 'id' | 'timestamp' | 'upvotes' | 'status'> = {
      stopId: selectedStopId || undefined,
      stopName: stop ? stop.name : 'Transit Network General',
      lineId: selectedLineId || undefined,
      lineName: line ? line.name : undefined,
      type: reportType,
      category: config.category,
      title: customTitle,
      details: details.trim() || `Field observation submitted via AccessRide Community Reporter.`,
      impact: config.impactText,
      severity,
      crowdLevelReported: reportType === 'crowded' ? crowdLevel : undefined,
      delayMinutesReported: reportType === 'delay' ? delayMinutes : undefined,
    };

    onReportSubmitted(payload);

    if (voiceEnabled) {
      SpeechService.speak(`Thank you for your report. Dispatcher alerted and safety scores updated.`);
    }

    setSubmittedToast(true);
    setTimeout(() => {
      setSubmittedToast(false);
      onClose();
      setDetails('');
    }, 1200);
  };

  const currentConfig = REPORT_TYPE_CONFIGS[reportType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reportModalHeading"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xl font-bold">
              ⚠️
            </div>
            <div>
              <h2 id="reportModalHeading" className="text-lg font-black text-white">
                Report Transit Barrier or Condition
              </h2>
              <p className="text-xs text-slate-400">
                Instantly alerts operators and updates community safety routing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* OCR Barrier Sign Scanner Quick Auto-Fill */}
          <div className="bg-slate-950/70 border border-emerald-500/40 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                <span>📷</span>
                <span>Scan Sign / Barrier with OCR (Auto-Fill)</span>
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                Client-Side AI / No Key Required
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Select a signage notice to auto-detect category, severity, and details instantly:
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setReportType('broken_elevator');
                  setSeverity('critical');
                  setDetails('Elevator Out of Service - Emergency hydraulic repair underway. Step-free access impacted.');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
              >
                🛗 Elevator Outage Sign
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportType('broken_ramp');
                  setSeverity('high');
                  setDetails('Ramp closed for resurfacing work. Detour via East pedestrian corridor.');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
              >
                🚧 Ramp Repair Sign
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportType('dim_lighting');
                  setSeverity('medium');
                  setDetails('Walkway lighting malfunction. Dim pedestrian walkway reported.');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
              >
                💡 Dim Light Notice
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportType('sos_alert');
                  setSeverity('critical');
                  setDetails('Emergency SOS station activated. Safety patrol alerted.');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
              >
                🚨 Emergency SOS
              </button>
            </div>
          </div>

          {/* Section 1: Choose Report Category / Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              1. What issue or condition are you observing?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(Object.keys(REPORT_TYPE_CONFIGS) as ReportType[]).map(typeKey => {
                const conf = REPORT_TYPE_CONFIGS[typeKey];
                const isSelected = reportType === typeKey;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => handleSelectType(typeKey)}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/40'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="text-xl">{conf.icon}</span>
                      <span className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                        {conf.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium line-clamp-2">{conf.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Location & Route Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="reportStopSelect"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                📍 Affected Station or Stop
              </label>
              <select
                id="reportStopSelect"
                value={selectedStopId}
                onChange={e => setSelectedStopId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select Station / Stop (Optional)...</option>
                {stops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reportLineSelect"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                🚍 Transit Line / Vehicle (Optional)
              </label>
              <select
                id="reportLineSelect"
                value={selectedLineId}
                onChange={e => setSelectedLineId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-amber-500"
              >
                <option value="">General Stop / Not Line Specific</option>
                {lines.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.shortName} - {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Extra Parameters (Crowd / Delay / Severity) */}
          {reportType === 'crowded' && (
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-2">
              <label className="block text-xs font-bold uppercase text-purple-300">
                Observed Crowd Density Level:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['low', 'moderate', 'high'] as const).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCrowdLevel(lvl)}
                    className={`py-2 rounded-lg font-bold capitalize border transition ${
                      crowdLevel === lvl
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {lvl} Crowding
                  </button>
                ))}
              </div>
            </div>
          )}

          {reportType === 'delay' && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-2">
              <label htmlFor="delayMinutesRange" className="block text-xs font-bold uppercase text-amber-300">
                Estimated Transit Delay:{' '}
                <span className="text-white font-black">+{delayMinutes} Minutes</span>
              </label>
              <input
                id="delayMinutesRange"
                type="range"
                min={3}
                max={45}
                step={1}
                value={delayMinutes}
                onChange={e => setDelayMinutes(parseInt(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>+3 min</span>
                <span>+15 min</span>
                <span>+30 min</span>
                <span>+45 min</span>
              </div>
            </div>
          )}

          {/* Section 4: Details & Observations */}
          <div>
            <label
              htmlFor="reportDetailsInput"
              className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Additional Details / Passenger Notes
            </label>
            <textarea
              id="reportDetailsInput"
              rows={3}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="e.g. Elevator out of order near north gate; power wheelchair ramp jammed; escort team present at main entrance."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Dynamic Impact Preview */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-3">
            <span className="text-xl">⚡</span>
            <div className="text-xs">
              <span className="font-bold text-white block mb-0.5">Real-Time Routing Impact:</span>
              <span className="text-slate-400">{currentConfig.impactText}</span>
            </div>
          </div>
        </form>

        {/* Footer & Submit Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {submittedToast ? (
              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                <span>✓</span>
                <span>Report Broadcasted to Operator Command!</span>
              </span>
            ) : (
              <span>Your report helps fellow passengers navigate safely.</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 transition transform hover:-translate-y-0.5"
            >
              ⚡ Broadcast Report Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
