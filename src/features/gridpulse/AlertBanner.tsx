import React from 'react';
import { AlertRecord } from './types';

interface AlertBannerProps {
  alerts: AlertRecord[];
  onDismiss: (alertId: string) => void;
  onSelectAlert?: (alert: AlertRecord) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  alerts,
  onDismiss,
  onSelectAlert,
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none space-y-2"
      role="alert"
      aria-live="assertive"
    >
      {alerts.slice(0, 3).map(alert => {
        const isCritical = alert.severity === 'critical';
        const isHigh = alert.severity === 'high';

        const bgClass = isCritical
          ? 'bg-rose-950/95 border-rose-500/80 text-rose-100'
          : isHigh
          ? 'bg-amber-950/95 border-amber-500/80 text-amber-100'
          : 'bg-blue-950/95 border-blue-500/80 text-blue-100';

        const badgeBg = isCritical
          ? 'bg-rose-600 text-white'
          : isHigh
          ? 'bg-amber-600 text-white'
          : 'bg-blue-600 text-white';

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-up ${bgClass}`}
          >
            <div
              className="flex items-center space-x-3 cursor-pointer flex-1 mr-3"
              onClick={() => onSelectAlert?.(alert)}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm shrink-0 ${badgeBg} animate-pulse`}
              >
                {isCritical ? '🚨' : isHigh ? '⚠️' : 'ℹ️'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm tracking-wide">
                    {alert.zoneName}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/40 font-mono">
                    {alert.distanceMeters === 0 ? 'INSIDE ZONE' : `${alert.distanceMeters}m away`}
                  </span>
                </div>
                <p className="text-xs opacity-90 line-clamp-1 mt-0.5">
                  {alert.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-black/30 hover:bg-black/50 transition-colors shrink-0"
              aria-label="Dismiss Alert"
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
};
