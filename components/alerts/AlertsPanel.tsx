'use client';

// React
import { useState, useMemo } from 'react';

// Types
import { AlertRow } from '@/lib/alerts';
import { AlertType, AlertSeverity, AlertStatus } from '@/database/models/Alert';

// Actions
import { dismissAlertAction } from '@/actions/alerts';

// Utils
import { formatDate } from '@/lib/utils';

// Dependencies
import { toast } from 'sonner';
import { PiSparkleFill, PiCheckCircleFill, PiXCircleFill } from 'react-icons/pi';

// ---------------------------------------------------------------------------
// Style / label maps — deliberately hardcoded rather than derived generically.
// Every dataPoints key is known in advance (defined by detectors.ts), so a
// purpose-built label reads far more like a real dashboard than a generic
// camelCase-splitter would.
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<AlertType, string> = {
  STOCK_DROP: 'Stock Drop',
  NEGATIVE_STOCK: 'Negative Stock',
  SYNC_DRIFT: 'Sync Drift',
  STORE_STATE_CONTRADICTION: 'Store Misconfiguration',
  STOCKOUT_RISK: 'Stockout Risk',
};

const TYPE_STYLES: Record<AlertType, string> = {
  STOCK_DROP: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  NEGATIVE_STOCK: 'text-red-400 bg-red-400/10 border-red-400/20',
  SYNC_DRIFT: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  STORE_STATE_CONTRADICTION: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  STOCKOUT_RISK: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  LOW: 'text-slate-300 bg-slate-500/10 ring-1 ring-slate-500/20',
  MEDIUM: 'text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30',
  HIGH: 'text-red-300 bg-red-500/10 ring-1 ring-red-500/30',
};

/** Human-readable label + formatted value for a single dataPoints entry.
 * Every key here is one this conversation's detectors.ts actually produces —
 * see lib/anomalies/detectors.ts for the authoritative source of what can
 * appear. Falls back to a generic camelCase split for anything unrecognized,
 * so a future 6th anomaly type doesn't render as raw JSON. */
function formatDataPoint(key: string, value: unknown): { label: string; value: string } {
  const LABELS: Record<string, string> = {
    sku: 'SKU',
    productName: 'Product',
    storeName: 'Store',
    oldStock: 'Previous Stock',
    newStock: 'Current Stock',
    change: 'Change',
    pctChange: '% Change',
    platform: 'Platform',
    occurredAt: 'Occurred',
    stock: 'Current Stock',
    velocity: 'Sales Velocity',
    daysRemaining: 'Days Remaining',
    lastSyncAt: 'Last Synced',
    mostRecentActivityAt: 'Last Activity',
    driftHours: 'Drift',
    isConnected: 'Connected',
    isSyncEnabled: 'Sync Enabled',
  };

  const label = LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

  // ISO-date-looking strings → formatted via the same util used elsewhere in the app.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return { label, value: formatDate(value) };

  if (key === 'pctChange' && typeof value === 'number') return { label, value: `${Math.round(value * 100)}%` };
  if (key === 'driftHours' && typeof value === 'number') return { label, value: `${value}h` };
  if (key === 'daysRemaining' && typeof value === 'number') return { label, value: `${value} day${value === 1 ? '' : 's'}` };
  if (key === 'velocity' && typeof value === 'number') return { label, value: `${value} units/day` };
  if (typeof value === 'boolean') return { label, value: value ? 'Yes' : 'No' };

  return { label, value: String(value) };
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const StatusBadge = ({ status }: { status: AlertStatus }) => {
  if (status === 'OPEN') {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-sm font-medium text-red-400">Open</span>
      </div>
    );
  }

  if (status === 'RESOLVED') {
    return (
      <div className="flex items-center gap-2 text-emerald-400">
        <PiCheckCircleFill className="h-4 w-4" />
        <span className="text-sm font-medium">Resolved</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-slate-500">
      <PiXCircleFill className="h-4 w-4" />
      <span className="text-sm font-medium">Dismissed</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Alert card
// ---------------------------------------------------------------------------

interface AlertCardProps {
  alert: AlertRow;
  isDismissing: boolean;
  onDismiss: (alertId: string) => void;
}

const AlertCard = ({ alert, isDismissing, onDismiss }: AlertCardProps) => {
  const dataPointEntries = Object.entries(alert.dataPoints).map(([key, value]) => formatDataPoint(key, value));

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6 transition-colors hover:border-white/20">
      {/* Header row: type + severity + status */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${TYPE_STYLES[alert.type]}`}>{TYPE_LABELS[alert.type]}</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${SEVERITY_STYLES[alert.severity]}`}>{alert.severity}</span>
        </div>
        <StatusBadge status={alert.status} />
      </div>

      {/* Data points — the code-level grounding layer. These numbers come
          directly from the detector, not from parsing the reasoning text
          below, so they're correct even if the LLM's prose weren't. */}
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-white/5 bg-black/20 p-4 sm:grid-cols-3">
        {dataPointEntries.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] font-medium tracking-wider text-slate-500 uppercase">{label}</div>
            <div className="font-mono text-sm text-slate-200">{value}</div>
          </div>
        ))}
      </div>

      {/* Reasoning — LLM-generated (or deterministic fallback), grounded to
          the data points above, never the sole source of truth for them. */}
      {alert.reasoning && (
        <div className="mb-4 flex items-start gap-2 text-sm text-slate-400">
          <PiSparkleFill className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
          <p>{alert.reasoning}</p>
        </div>
      )}

      {/* Footer: timestamp + dismiss action */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-xs text-slate-600">{formatDate(alert.createdAt)}</span>

        {alert.status === 'OPEN' && (
          <button onClick={() => onDismiss(alert._id)} disabled={isDismissing} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
            {isDismissing ? 'Dismissing...' : 'Dismiss'}
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-900/30 py-20 text-center">
    <PiCheckCircleFill className="h-10 w-10 text-emerald-500" />
    <div className="text-lg font-semibold text-slate-200">No alerts</div>
    <p className="max-w-sm text-sm text-slate-500">The anomaly agent hasn&apos;t flagged anything. It runs every 6 hours and checks for stock drops, negative inventory, sync drift, misconfigured stores, and stockout risk.</p>
  </div>
);

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface AlertsPanelProps {
  alerts: AlertRow[];
}

const AlertsPanel = ({ alerts: initialAlerts }: AlertsPanelProps) => {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);
  const [dismissingIds, setDismissingIds] = useState<string[]>([]);

  const stats = useMemo(() => {
    const open = alerts.filter((a) => a.status === 'OPEN');
    return {
      open: open.length,
      highSeverityOpen: open.filter((a) => a.severity === 'HIGH').length,
      resolved: alerts.filter((a) => a.status === 'RESOLVED').length,
      dismissed: alerts.filter((a) => a.status === 'DISMISSED').length,
    };
  }, [alerts]);

  const handleDismiss = async (alertId: string) => {
    if (dismissingIds.includes(alertId)) return;

    setDismissingIds((prev) => [...prev, alertId]);
    const { success, message } = await dismissAlertAction(alertId);

    if (success) {
      toast.success(message);
      setAlerts((prev) => prev.map((a) => (a._id === alertId ? { ...a, status: 'DISMISSED' as AlertStatus, dismissedAt: new Date().toISOString() } : a)));
    } else {
      toast.error(message);
    }

    setDismissingIds((prev) => prev.filter((id) => id !== alertId));
  };

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Inventory Alerts</h1>
          <p className="mt-1 text-sm text-slate-500">Anomalies detected automatically every 6 hours — stock drops, negative inventory, sync drift, store misconfiguration, and stockout risk.</p>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.open}</div>
            <div className="text-xs tracking-wide text-slate-500 uppercase">Open</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{stats.highSeverityOpen}</div>
            <div className="text-xs tracking-wide text-slate-500 uppercase">High Severity</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div>
            <div className="text-xs tracking-wide text-slate-500 uppercase">Resolved</div>
          </div>
        </div>
      </div>

      {/* List */}
      {alerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {alerts.map((alert) => (
            <AlertCard key={alert._id} alert={alert} isDismissing={dismissingIds.includes(alert._id)} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;
