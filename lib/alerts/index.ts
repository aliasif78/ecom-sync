// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Replaces Product.stockoutRisk as the data source for the products-page
// "Stockout Risk" badge (see ProductTable.tsx). That field was only ever
// written by smartStockout.ts, which Feature 2 replaces entirely — reading
// it after deletion would mean the badge freezes forever at its last value
// instead of reflecting anything current. This queries the live Alert
// collection instead, so the badge stays backed by whatever system is
// actually still running.
//
// Deliberately a NEW, separate file rather than added to lib/products/index.ts
// — that file has other exports this conversation never had full visibility
// into (createProduct/updateProduct/etc., inferred from PostHog event
// imports), so extending it blind risked dropping code. Feel free to move
// this into lib/products/index.ts yourself once you can see the whole file.

// ==========================================
// 📦 Imports
// ==========================================

import { Types } from 'mongoose';

import { connectDB } from '@/database/mongoose';
import Alert, { ALERT_TYPE, ALERT_STATUS, AlertType, AlertSeverity, AlertStatus } from '@/database/models/Alert';

// ==========================================
// 🚓 TYPES
// ==========================================

/**
 * Serialized Alert document — safe to pass as a React prop. Defined here
 * rather than in types/index.ts, matching the precedent already set by
 * QueryInventoryResult living in lib/inventory/queryInventory.ts rather
 * than the shared types file — co-located with the module that owns it.
 */
export interface AlertRow {
  _id: string;
  type: AlertType;
  severity: AlertSeverity;
  productId?: string;
  storeId?: string;
  dataPoints: Record<string, unknown>;
  reasoning: string | null;
  status: AlertStatus;
  createdAt: string;
  resolvedAt: string | null;
  dismissedAt: string | null;
}

// ==========================================
// 🚀 EXPORTS
// ==========================================

/**
 * Returns the productId (as strings) of every OPEN STOCKOUT_RISK alert
 * belonging to this user. Used by the products page to decide which rows
 * get the "Stockout Risk" badge — membership in this list, not a stored
 * boolean, so it's only ever as stale as the last anomaly-agent run (every
 * 6h), not "whenever smartStockout.ts last happened to run before deletion."
 */
export async function getOpenStockoutRiskProductIds(userId: string): Promise<string[]> {
  await connectDB();

  const alerts = await Alert.find({
    userId: new Types.ObjectId(userId),
    type: ALERT_TYPE.STOCKOUT_RISK,
    status: ALERT_STATUS.OPEN,
  })
    .select('productId')
    .lean();

  return alerts.map((alert) => alert.productId?.toString()).filter((id): id is string => !!id);
}

/**
 * Fetches this user's alerts for the /alerts page. OPEN alerts always come
 * first (fetched and sorted separately, not via a single alphabetical sort
 * on `status` — 'DISMISSED' < 'OPEN' < 'RESOLVED' alphabetically would put
 * open alerts in the middle, which is wrong for a "what needs my attention"
 * view). Non-open alerts are capped at 50 — this is a recent-history tail,
 * not a full audit log.
 */
export async function getAlertsForUser(userId: string): Promise<AlertRow[]> {
  await connectDB();

  const uid = new Types.ObjectId(userId);

  const [openAlerts, otherAlerts] = await Promise.all([
    Alert.find({ userId: uid, status: ALERT_STATUS.OPEN }).sort({ createdAt: -1 }).lean(),
    Alert.find({ userId: uid, status: { $ne: ALERT_STATUS.OPEN } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  return [...openAlerts, ...otherAlerts].map((alert) => ({
    _id: alert._id.toString(),
    type: alert.type,
    severity: alert.severity,
    productId: alert.productId?.toString(),
    storeId: alert.storeId?.toString(),
    dataPoints: alert.dataPoints as Record<string, unknown>,
    reasoning: alert.reasoning,
    status: alert.status,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : null,
    dismissedAt: alert.dismissedAt ? new Date(alert.dismissedAt).toISOString() : null,
  }));
}

/**
 * Dismisses an alert — ownership-checked (matches `userId`), and only if
 * it's currently OPEN (dismissing an already-resolved/dismissed alert is a
 * no-op error, not silently allowed, so the UI can surface a clear message
 * instead of pretending it did something).
 */
export async function dismissAlert(alertId: string, userId: string): Promise<{ success: boolean; message: string }> {
  await connectDB();

  const alert = await Alert.findOne({ _id: alertId, userId: new Types.ObjectId(userId) });
  if (!alert) return { success: false, message: 'Alert not found.' };

  if (alert.status !== ALERT_STATUS.OPEN) {
    return { success: false, message: `Alert is already ${alert.status.toLowerCase()}.` };
  }

  await alert.dismiss();
  return { success: true, message: 'Alert dismissed.' };
}
