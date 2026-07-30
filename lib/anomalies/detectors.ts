// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// This is the detection layer for Feature 2 (Inventory Anomaly Agent).
// Every function here is a PURE READ: no writes to any collection, no AI
// calls. Each returns candidate anomalies with `dataPoints` already computed
// and a `dedupeKey` already assigned. The LLM (lib/anomalies/generateReasoning.ts,
// Phase 3) never sees anything these functions didn't already decide was an
// anomaly — its only job is turning `dataPoints` into a sentence.
//
// Global vs. per-user: every detector runs GLOBALLY (no userId param) and
// returns candidates each carrying their own `userId`, matching
// smartStockout.ts's existing pattern (one query across all users, not N
// queries per user). This is the version of the "userId or global" choice
// left open in the Phase 2 plan — chosen for the same reason the original
// cron did it this way: a single aggregation scales better than fan-out per
// tenant for a job that runs unattended every 6 hours.
//
// ⚠️ recentSalesVelocity dead-field warning: detectStockoutRisk deliberately
// recomputes the 14-day sales velocity itself via a pure aggregation, rather
// than reading Product.recentSalesVelocity. That cached field is only ever
// written by smartStockout.ts's bulk-write step, which Feature 2 replaces
// entirely (Phase 5). Reading it here would mean silently trusting a field
// nothing updates anymore the moment the old cron is deleted. See Alert.ts
// and the Phase 5 note for what happens to that field going forward.
//
// ⚠️ Store→ledger attribution: InventoryLedger has no storeId field, only
// `platform` (a user can have 2 Shopify stores — platform alone can't tell
// them apart). detectSyncDrift resolves this correctly by going through
// Product.mappings.<platform>.storeId — since a product can only be synced
// to ONE store per platform (documented constraint in Product.ts), every
// ledger entry for a given product+platform is unambiguously attributable to
// exactly one store, even if the user owns several stores of that platform.
//
// ⚠️ Known N+1 pattern in detectSyncDrift (2 queries per active store):
// acceptable at portfolio/demo scale, same documented tradeoff as
// queryInventory.ts's per-candidate duration lookups. Would need a single
// aggregation pipeline with $lookup if store counts ever got large.

// ==========================================
// 📦 Imports
// ==========================================

import { Types } from 'mongoose';

import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';
import Store from '@/database/models/Store';
import InventoryLedger from '@/database/models/InventoryLedger';
import { ALERT_TYPE, ALERT_SEVERITY, AlertType, AlertSeverity } from '@/database/models/Alert';
import { EPlatform } from '@/lib/globalConstants';

// ==========================================
// 💿 THRESHOLDS
// ==========================================
// Every number below is a stated assumption, not a guess left implicit —
// same discipline as the RAG confidence-threshold caveat. Calibrated against
// reasoning about the cron cadence (every 6h) and the domain, not against
// real production data yet — revisit once real usage exists.

// --- Stock drop ---
// A single ledger entry must clear BOTH bars to count: an absolute floor
// (so a product at stock=2 dropping to 1 doesn't register as "100% drop"),
// and a relative bar (so a 5-unit drop on a product with 10,000 in stock
// doesn't register as significant).
const STOCK_DROP_MIN_ABS_UNITS = 5;
const STOCK_DROP_MIN_PCT = 0.3; // 30%
// Lookback window is intentionally generous (24h, 4x the 6h cron interval)
// rather than tightly matched to cadence — safe to over-fetch here because
// dedupe is keyed to the specific ledger entry _id, not to time, so a missed
// cron cycle or a slow run can never produce a duplicate alert.
const STOCK_DROP_WINDOW_HOURS = 24;

// --- Negative stock ---
// No detection threshold (stock < 0 is unambiguous) — these only tier severity.
const NEGATIVE_STOCK_HIGH_AT = -10;
const NEGATIVE_STOCK_MEDIUM_AT = -3;

// --- Sync drift ---
// One missed cron cycle (6h) of tolerance before flagging, to absorb
// ordinary scheduling jitter rather than firing on every marginal delay.
const SYNC_DRIFT_STALENESS_HOURS = 12;

// --- Stockout risk ---
const STOCKOUT_RISK_WINDOW_DAYS = 14; // matches the existing velocity window in smartStockout.ts
const STOCKOUT_RISK_DAYS_THRESHOLD = 7; // matches the original prompt's "< 7 days" and published landing-page copy

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

// Platform → mappings sub-document key. Duplicated from the equivalent map
// in lib/inventory/queryInventory.ts (not exported there) — worth hoisting
// both to a shared location in lib/globalConstants.ts if a third consumer
// ever needs it, but not touching that file as part of this phase.
const MAPPING_KEY: Partial<Record<EPlatform, 'shopify' | 'amazon' | 'woocommerce'>> = {
  [EPlatform.SHOPIFY]: 'shopify',
  [EPlatform.AMAZON]: 'amazon',
  [EPlatform.WOOCOMMERCE]: 'woocommerce',
};

// ==========================================
// 🚓 TYPES
// ==========================================

/**
 * The output shape of every detector. This is what Phase 3 (reasoning) reads
 * `dataPoints` from, and what Phase 4 (Inngest orchestration) upserts into
 * the Alert collection keyed by `dedupeKey`.
 */
export interface AnomalyCandidate {
  userId: Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  productId?: Types.ObjectId;
  storeId?: Types.ObjectId;
  dataPoints: Record<string, unknown>;
  dedupeKey: string;
}

// ==========================================
// 🔧 SEVERITY HELPERS
// ==========================================
// Kept as small named functions rather than inlined ternaries so the tiers
// are visible and testable on their own, independent of the query logic.

function severityForStockDropPct(pct: number): AlertSeverity {
  if (pct >= 0.75) return ALERT_SEVERITY.HIGH;
  if (pct >= 0.5) return ALERT_SEVERITY.MEDIUM;
  return ALERT_SEVERITY.LOW; // still >= STOCK_DROP_MIN_PCT to have reached here at all
}

function severityForNegativeStock(stock: number): AlertSeverity {
  if (stock <= NEGATIVE_STOCK_HIGH_AT) return ALERT_SEVERITY.HIGH;
  if (stock <= NEGATIVE_STOCK_MEDIUM_AT) return ALERT_SEVERITY.MEDIUM;
  return ALERT_SEVERITY.LOW;
}

function severityForDriftHours(hours: number): AlertSeverity {
  if (hours >= 48) return ALERT_SEVERITY.HIGH;
  if (hours >= 24) return ALERT_SEVERITY.MEDIUM;
  return ALERT_SEVERITY.LOW; // still >= SYNC_DRIFT_STALENESS_HOURS to have reached here at all
}

function severityForDaysRemaining(days: number): AlertSeverity {
  if (days < 1) return ALERT_SEVERITY.HIGH;
  if (days < 3) return ALERT_SEVERITY.MEDIUM;
  return ALERT_SEVERITY.LOW; // still < STOCKOUT_RISK_DAYS_THRESHOLD to have reached here at all
}

// ==========================================
// 1️⃣ STOCK DROP
// ==========================================

/**
 * Flags individual InventoryLedger entries representing a sudden, large
 * drop in a product's stock. Discrete-event type — dedupeKey is tied to the
 * specific ledger entry, so a new drop on a product that already has an
 * open/resolved/dismissed alert from a PRIOR drop still gets its own alert.
 */
export async function detectStockDrops(): Promise<AnomalyCandidate[]> {
  await connectDB();

  const windowStart = new Date(Date.now() - STOCK_DROP_WINDOW_HOURS * MS_PER_HOUR);

  const entries = await InventoryLedger.aggregate([
    // Cheap pre-filter before computing percentages
    { $match: { createdAt: { $gte: windowStart }, change: { $lte: -STOCK_DROP_MIN_ABS_UNITS } } },

    // Guard divide-by-zero / nonsensical percentages — a product that was
    // already at 0 dropping "further" isn't a stock-drop anomaly, it's
    // already covered by detectNegativeStock if it went negative.
    { $match: { oldStock: { $gt: 0 } } },

    { $addFields: { pctChange: { $divide: [{ $abs: '$change' }, '$oldStock'] } } },
    { $match: { pctChange: { $gte: STOCK_DROP_MIN_PCT } } },

    // Join for product name/sku and to exclude archived products (this is a
    // raw $lookup against the products collection, so the Product schema's
    // pre('find') archived-exclusion hook does NOT apply — filtered explicitly).
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $match: { 'product.isArchived': { $ne: true } } },

    { $sort: { createdAt: -1 } },
  ]);

  return entries.map((entry) => ({
    userId: entry.userId,
    type: ALERT_TYPE.STOCK_DROP as AlertType,
    severity: severityForStockDropPct(entry.pctChange),
    productId: entry.productId,
    dataPoints: {
      sku: entry.product.sku,
      productName: entry.product.name,
      oldStock: entry.oldStock,
      newStock: entry.newStock,
      change: entry.change,
      pctChange: Math.round(entry.pctChange * 100) / 100,
      platform: entry.platform,
      occurredAt: entry.createdAt,
    },
    dedupeKey: `${ALERT_TYPE.STOCK_DROP}:${entry._id}`,
  }));
}

// ==========================================
// 2️⃣ NEGATIVE STOCK
// ==========================================

/**
 * Flags products currently sitting at a negative stock value — a data
 * integrity bug (an oversell that slipped past whatever guard should have
 * stopped it), not a business-metric judgment call. Ongoing-condition type —
 * dedupeKey is stable per product (see Correction 1 above).
 */
export async function detectNegativeStock(): Promise<AnomalyCandidate[]> {
  await connectDB();

  // Product's own pre('find') hook already excludes archived products here.
  const products = await Product.find({ stock: { $lt: 0 } })
    .select('_id userId sku name stock')
    .lean();

  return products.map((product) => ({
    userId: product.userId,
    type: ALERT_TYPE.NEGATIVE_STOCK as AlertType,
    severity: severityForNegativeStock(product.stock),
    productId: product._id,
    dataPoints: {
      sku: product.sku,
      productName: product.name,
      stock: product.stock,
    },
    dedupeKey: `${ALERT_TYPE.NEGATIVE_STOCK}:${product._id}`,
  }));
}

// ==========================================
// 3️⃣ SYNC DRIFT
// ==========================================

/**
 * Flags stores where inventory activity has happened on a platform more
 * recently than that store's last recorded sync — the "stores silently
 * drift out of sync" failure mode. Ongoing-condition type — dedupeKey is
 * stable per store.
 */
export async function detectSyncDrift(): Promise<AnomalyCandidate[]> {
  await connectDB();

  const stores = await Store.find({ isConnected: true, isSyncEnabled: true }).select('_id userId platform name lastSyncAt').lean();

  const candidates: AnomalyCandidate[] = [];

  for (const store of stores) {
    const mappingKey = MAPPING_KEY[store.platform as EPlatform];
    if (!mappingKey) continue; // defensive: unknown/unsupported platform value

    // Products actually mapped to THIS store (not just "any store of this
    // platform") — see the store→ledger attribution note above.
    const mappedProducts = await Product.find({ [`mappings.${mappingKey}.storeId`]: store._id })
      .select('_id')
      .lean();

    if (mappedProducts.length === 0) continue; // nothing synced here yet — not drift, just new

    const mostRecentActivity = await InventoryLedger.findOne({
      productId: { $in: mappedProducts.map((p) => p._id) },
      platform: store.platform,
    })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();

    if (!mostRecentActivity) continue; // mapped, but no ledger activity yet

    // Never-synced store = maximally stale, not a divide-by-zero/null issue.
    const referenceTime = store.lastSyncAt ?? new Date(0);
    const driftHours = (mostRecentActivity.createdAt.getTime() - referenceTime.getTime()) / MS_PER_HOUR;

    if (driftHours < SYNC_DRIFT_STALENESS_HOURS) continue;

    candidates.push({
      userId: store.userId,
      type: ALERT_TYPE.SYNC_DRIFT as AlertType,
      severity: severityForDriftHours(driftHours),
      storeId: store._id,
      dataPoints: {
        storeName: store.name,
        platform: store.platform,
        lastSyncAt: store.lastSyncAt,
        mostRecentActivityAt: mostRecentActivity.createdAt,
        driftHours: Math.round(driftHours),
      },
      dedupeKey: `${ALERT_TYPE.SYNC_DRIFT}:${store._id}`,
    });
  }

  return candidates;
}

// ==========================================
// 4️⃣ STORE STATE CONTRADICTION
// ==========================================

/**
 * Flags stores configured to sync (isSyncEnabled: true) while not actually
 * connected (isConnected: false) — a config bug, arguably worse than mere
 * drift since sync isn't degraded here, it's not happening at all. No
 * threshold to tune; the condition itself is the anomaly. Ongoing-condition
 * type — dedupeKey is stable per store.
 */
export async function detectStoreStateContradictions(): Promise<AnomalyCandidate[]> {
  await connectDB();

  const stores = await Store.find({ isConnected: false, isSyncEnabled: true }).select('_id userId platform name').lean();

  return stores.map((store) => ({
    userId: store.userId,
    type: ALERT_TYPE.STORE_STATE_CONTRADICTION as AlertType,
    severity: ALERT_SEVERITY.HIGH as AlertSeverity, // single fixed severity — see docstring
    storeId: store._id,
    dataPoints: {
      storeName: store.name,
      platform: store.platform,
      isConnected: false,
      isSyncEnabled: true,
    },
    dedupeKey: `${ALERT_TYPE.STORE_STATE_CONTRADICTION}:${store._id}`,
  }));
}

// ==========================================
// 5️⃣ STOCKOUT RISK
// ==========================================

/**
 * Flags products projected to run out within STOCKOUT_RISK_DAYS_THRESHOLD
 * days, based on a freshly-computed 14-day sales velocity. Reuses the
 * aggregation shape from smartStockout.ts's "calculate-sales-velocity" step,
 * but as a pure read — see the dead-field warning at the top of this file
 * for why this does NOT read or write Product.recentSalesVelocity.
 * Ongoing-condition type — dedupeKey is stable per product.
 */
export async function detectStockoutRisk(): Promise<AnomalyCandidate[]> {
  await connectDB();

  const windowStart = new Date(Date.now() - STOCKOUT_RISK_WINDOW_DAYS * MS_PER_DAY);

  const candidates = await InventoryLedger.aggregate([
    // Only sales (negative changes), not restocks — same filter as smartStockout.ts
    { $match: { createdAt: { $gte: windowStart }, change: { $lt: 0 } } },

    { $group: { _id: '$productId', userId: { $first: '$userId' }, totalSold: { $sum: { $abs: '$change' } } } },
    { $addFields: { velocity: { $divide: ['$totalSold', STOCKOUT_RISK_WINDOW_DAYS] } } },

    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $match: { 'product.isArchived': { $ne: true }, 'product.stock': { $gt: 0 } } },

    { $addFields: { daysRemaining: { $divide: ['$product.stock', '$velocity'] } } },
    { $match: { daysRemaining: { $lt: STOCKOUT_RISK_DAYS_THRESHOLD } } },
  ]);

  return candidates.map((candidate) => ({
    userId: candidate.userId,
    type: ALERT_TYPE.STOCKOUT_RISK as AlertType,
    severity: severityForDaysRemaining(candidate.daysRemaining),
    productId: candidate._id,
    dataPoints: {
      sku: candidate.product.sku,
      productName: candidate.product.name,
      stock: candidate.product.stock,
      velocity: Math.round(candidate.velocity * 100) / 100,
      daysRemaining: Math.round(candidate.daysRemaining * 10) / 10,
    },
    dedupeKey: `${ALERT_TYPE.STOCKOUT_RISK}:${candidate._id}`,
  }));
}

// ==========================================
// 🧪 TEST CONVENIENCE — NOT used by Inngest orchestration
// ==========================================
// Phase 4 calls the 5 functions above individually, one per Inngest step, so
// that one detector throwing doesn't block the others (same per-step
// isolation principle as syncStockToStores). This aggregator exists purely
// so the Phase 2 test script can run everything in one pass during
// standalone verification.

export async function runAllDetectors(): Promise<Record<AlertType, AnomalyCandidate[]>> {
  const [stockDrops, negativeStock, syncDrift, storeStateContradictions, stockoutRisk] = await Promise.all([detectStockDrops(), detectNegativeStock(), detectSyncDrift(), detectStoreStateContradictions(), detectStockoutRisk()]);

  return {
    [ALERT_TYPE.STOCK_DROP]: stockDrops,
    [ALERT_TYPE.NEGATIVE_STOCK]: negativeStock,
    [ALERT_TYPE.SYNC_DRIFT]: syncDrift,
    [ALERT_TYPE.STORE_STATE_CONTRADICTION]: storeStateContradictions,
    [ALERT_TYPE.STOCKOUT_RISK]: stockoutRisk,
  } as Record<AlertType, AnomalyCandidate[]>;
}
