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
import Alert, { ALERT_TYPE, ALERT_STATUS } from '@/database/models/Alert';

// ==========================================
// 🚀 EXPORT
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
