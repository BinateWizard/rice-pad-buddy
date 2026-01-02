/**
 * Alert Notification Component
 * 
 * Displays real-time alerts with dismiss/acknowledge buttons
 * Can be placed in header or dashboard
 */

'use client';

import React, { useMemo } from 'react';
import { useAlerts, type Alert } from '@/context/AlertContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatTimeAgo } from '@/lib/utils';

/**
 * AlertBadge: Shows unread/critical alert count
 * Great for header/navbar
 */
export function AlertBadge() {
  const { unreadCount, criticalCount } = useAlerts();

  if (unreadCount === 0) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <div
        className={`absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white ${
          criticalCount > 0 ? 'bg-red-600' : 'bg-yellow-500'
        }`}
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </div>
      <div className="w-6 h-6">
        {criticalCount > 0 ? (
          <span className="text-xl">🚨</span>
        ) : (
          <span className="text-xl">⚠️</span>
        )}
      </div>
    </div>
  );
}

/**
 * AlertItem: Single alert card
 */
function AlertItem({ alert, onMarkRead, onAcknowledge }: { alert: Alert; onMarkRead: () => void; onAcknowledge: () => void }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <Card className={`border-l-4 p-4 ${getSeverityColor(alert.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
            <h4 className="font-semibold text-sm">
              {alert.severity.toUpperCase()}
            </h4>
            {!alert.read && (
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
          <p className="text-xs text-gray-500">
            {alert.createdAt ? formatTimeAgo(alert.createdAt.toMillis?.() || Date.now()) : 'Just now'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {!alert.acknowledged && alert.severity === 'critical' && (
            <Button
              size="sm"
              variant="default"
              onClick={onAcknowledge}
              className="text-xs"
            >
              Acknowledge
            </Button>
          )}
          {!alert.read && (
            <Button
              size="sm"
              variant="outline"
              onClick={onMarkRead}
              className="text-xs"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * AlertPanel: Full alerts list
 * Display in a modal, sidebar, or dedicated page
 */
export function AlertPanel({ fieldId, maxHeight = 'max-h-96' }: { fieldId?: string; maxHeight?: string }) {
  const { alerts, isLoading, getAlertsByField, markAsRead, acknowledge } = useAlerts();

  const displayAlerts = useMemo(() => {
    if (fieldId) {
      return getAlertsByField(fieldId);
    }
    return alerts;
  }, [alerts, fieldId, getAlertsByField]);

  // Sort: unacknowledged critical first, then by date
  const sortedAlerts = useMemo(() => {
    return [...displayAlerts].sort((a, b) => {
      // Critical unacknowledged first
      if (!a.acknowledged && a.severity === 'critical') return -1;
      if (!b.acknowledged && b.severity === 'critical') return 1;
      
      // Then by date (newest first)
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [displayAlerts]);

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading alerts...</div>;
  }

  if (sortedAlerts.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        ✅ All clear! No alerts at this time.
      </div>
    );
  }

  return (
    <div className={`${maxHeight} overflow-y-auto space-y-3 p-4`}>
      {sortedAlerts.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onMarkRead={() => markAsRead(alert.id, alert.fieldId)}
          onAcknowledge={() => acknowledge(alert.id, alert.fieldId)}
        />
      ))}
    </div>
  );
}

/**
 * AlertBanner: Sticky notification at top of page
 * Shows most critical unacknowledged alert
 */
export function AlertBanner() {
  const { alerts, acknowledge } = useAlerts();

  const mostCritical = useMemo(() => {
    const unacknowledged = alerts.filter((a) => !a.acknowledged);
    const critical = unacknowledged.find((a) => a.severity === 'critical');
    return critical || unacknowledged[0];
  }, [alerts]);

  if (!mostCritical) {
    return null;
  }

  const bgColor = mostCritical.severity === 'critical' ? 'bg-red-600' : 'bg-yellow-600';

  return (
    <div className={`${bgColor} text-white p-3 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className="text-lg">
          {mostCritical.severity === 'critical' ? '🚨' : '⚠️'}
        </span>
        <div>
          <p className="font-semibold text-sm">{mostCritical.message}</p>
          <p className="text-xs opacity-90">{mostCritical.paddyId}</p>
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="text-white hover:bg-white/20"
        onClick={() => acknowledge(mostCritical.id, mostCritical.fieldId)}
      >
        Acknowledge
      </Button>
    </div>
  );
}

/**
 * AlertStats: Summary of alerts
 */
export function AlertStats() {
  const { alerts, criticalCount } = useAlerts();

  const stats = {
    total: alerts.length,
    critical: criticalCount,
    unread: alerts.filter((a) => !a.read).length,
    unacknowledged: alerts.filter((a) => !a.acknowledged).length,
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="p-3 bg-gray-100 rounded">
        <p className="text-xs text-gray-600 uppercase">Total Alerts</p>
        <p className="text-2xl font-bold">{stats.total}</p>
      </div>
      <div className="p-3 bg-red-100 rounded">
        <p className="text-xs text-red-600 uppercase">Critical</p>
        <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
      </div>
      <div className="p-3 bg-yellow-100 rounded">
        <p className="text-xs text-yellow-600 uppercase">Unread</p>
        <p className="text-2xl font-bold text-yellow-600">{stats.unread}</p>
      </div>
      <div className="p-3 bg-blue-100 rounded">
        <p className="text-xs text-blue-600 uppercase">Unacknowledged</p>
        <p className="text-2xl font-bold text-blue-600">{stats.unacknowledged}</p>
      </div>
    </div>
  );
}
