// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// This is the data layer for Feature 1 (Natural Language Inventory Queries).
// It is intentionally decoupled from the AI/tool-calling layer — the model
// only ever supplies structured parameters (condition, platform, threshold,
// minDurationDays). It never writes or influences the query logic itself.
//
// ⚠️ VERIFIED ASSUMPTION (confirm this matches your understanding before relying on it):
// InventoryLedger.newStock/oldStock track the PRODUCT'S TOTAL stock, not a
// per-location or per-platform number. This is based on `syncProductStock`
// in actions/inventory.ts, which sets `oldStock = product.stock` (the root
// cached total) and writes `newStock` as the new total, against the single
// DEF_LOC_ID location. There is currently no per-platform stock number in
// this schema — inventory is a single unified pool, which is correct for
// preventing oversell, but it means "out of stock on Amazon" cannot mean
// "Amazon's stock is 0" (no such field exists). Instead it is defined here as:
//
//   stock === 0  AND  product has an active mapping to that platform
//   (mappings.<platform>.storeId exists)
//
// If future ledger-writing paths (e.g. an order-fulfillment webhook) ever
// start writing per-location, non-DEF_LOC_ID entries, this assumption breaks
// and the duration logic below needs revisiting.
//
// ⚠️ KNOWN LIMITATION: the duration lookup below runs up to 2 extra Mongo
// queries PER CANDIDATE PRODUCT (N+1 pattern). Fine at portfolio/demo scale
// (dozens–low hundreds of products). At real scale this should be rewritten
// as a single aggregation pipeline with $lookup + $sort + $group. Documented
// here and in the README rather than silently left as a surprise.

// ==========================================
// 📦 Imports
// ==========================================

import { Types } from 'mongoose';

import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';
import InventoryLedger from '@/database/models/InventoryLedger';
import { EPlatform } from '@/lib/globalConstants';

// ==========================================
// 🚓 TYPES
// ==========================================

export type QueryCondition = 'outOfStock' | 'lowStock' | 'stockAbove' | 'stockBelow';
export type QueryPlatform = 'all' | EPlatform.SHOPIFY | EPlatform.AMAZON | EPlatform.WOOCOMMERCE;

export interface QueryInventoryParams {
  userId: string;
  condition: QueryCondition;
  /** Defaults to 'all' — no platform filter. */
  platform?: QueryPlatform;
  /** Required for stockAbove/stockBelow. Defaults to 10 for lowStock (matches the existing /products page "low stock" convention). Unused for outOfStock. */
  threshold?: number;
  /** Only meaningful for outOfStock/lowStock. Defaults to 0 (no minimum — any duration matches). */
  minDurationDays?: number;
}

export interface QueryInventoryResult {
  sku: string;
  name: string;
  stock: number;
  platform: QueryPlatform;
  /** Present only for outOfStock/lowStock results. */
  daysInCondition?: number;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const MAX_RESULTS = 100;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const MAPPING_KEY: Partial<Record<EPlatform, 'shopify' | 'amazon' | 'woocommerce'>> = {
  [EPlatform.SHOPIFY]: 'shopify',
  [EPlatform.AMAZON]: 'amazon',
  [EPlatform.WOOCOMMERCE]: 'woocommerce',
};

// ==========================================
// 🔧 HELPERS
// ==========================================

/** Builds the Mongo filter fragment for platform scoping. Empty object = no filter (platform 'all'). */
function platformMatchStage(platform: QueryPlatform): Record<string, unknown> {
  if (platform === 'all') return {};
  const key = MAPPING_KEY[platform as EPlatform];
  if (!key) return {};
  return { [`mappings.${key}.storeId`]: { $exists: true } };
}

/**
 * For a single product currently at-or-below `exitThreshold`, finds how many
 * days it has CONTINUOUSLY been at-or-below that threshold (not just "ever
 * dropped below it at some point").
 *
 * Logic:
 *   1. Find the most recent ledger entry where newStock > exitThreshold
 *      ("the last time it was NOT in this condition").
 *   2. Find the earliest ledger entry AFTER that one — this is the entry
 *      that crossed INTO the current condition and hasn't been exited since.
 *   3. If no entry above the threshold exists at all, fall back to the
 *      earliest ledger entry for the product, or the product's createdAt
 *      if it has no ledger history yet.
 *
 * This correctly handles oscillation (recover then relapse) — see
 * scripts/seed-query-inventory-test.ts Product C for the exact case this
 * guards against.
 */
async function daysSinceEnteredCondition(productId: Types.ObjectId, userId: Types.ObjectId, exitThreshold: number, productCreatedAt: Date): Promise<number> {
  const lastGoodEntry = await InventoryLedger.findOne({
    productId,
    userId,
    newStock: { $gt: exitThreshold },
  })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();

  let crossingDate: Date;

  if (lastGoodEntry) {
    const crossingEntry = await InventoryLedger.findOne({
      productId,
      userId,
      createdAt: { $gt: lastGoodEntry.createdAt },
    })
      .sort({ createdAt: 1 })
      .select('createdAt')
      .lean();

    // Should always exist if the product is currently in-condition, but fall
    // back defensively rather than throwing on a data inconsistency.
    crossingDate = crossingEntry ? crossingEntry.createdAt : lastGoodEntry.createdAt;
  } else {
    // Never had stock above the threshold — check for any ledger history at all.
    const earliestEntry = await InventoryLedger.findOne({ productId, userId }).sort({ createdAt: 1 }).select('createdAt').lean();

    crossingDate = earliestEntry ? earliestEntry.createdAt : productCreatedAt;
  }

  return Math.floor((Date.now() - crossingDate.getTime()) / MS_PER_DAY);
}

// ==========================================
// 🔍 MAIN ENTRY POINT
// ==========================================

export async function queryInventory(params: QueryInventoryParams): Promise<QueryInventoryResult[]> {
  const { userId, condition, platform = 'all', minDurationDays = 0 } = params;
  let { threshold } = params;

  // --- Defensive validation (defense in depth — Zod at the tool layer should catch this first) ---
  if ((condition === 'stockAbove' || condition === 'stockBelow') && threshold === undefined) {
    throw new Error(`"threshold" is required for condition "${condition}".`);
  }
  if (condition === 'lowStock' && threshold === undefined) {
    threshold = DEFAULT_LOW_STOCK_THRESHOLD;
  }

  await connectDB();
  const userObjectId = new Types.ObjectId(userId);
  const platformFilter = platformMatchStage(platform);

  // ---------------------------------------------------------------------
  // Simple threshold conditions — no duration concept, straight find().
  // ---------------------------------------------------------------------
  if (condition === 'stockAbove' || condition === 'stockBelow') {
    const stockFilter = condition === 'stockAbove' ? { $gt: threshold! } : { $lt: threshold! };

    const products = await Product.find({
      userId: userObjectId,
      ...platformFilter,
      stock: stockFilter,
    })
      .select('sku name stock')
      .sort({ stock: condition === 'stockAbove' ? -1 : 1 })
      .limit(MAX_RESULTS)
      .lean();

    return products.map((p) => ({ sku: p.sku, name: p.name, stock: p.stock, platform }));
  }

  // ---------------------------------------------------------------------
  // Duration-aware conditions — outOfStock / lowStock
  // ---------------------------------------------------------------------
  const exitThreshold = condition === 'outOfStock' ? 0 : threshold!;
  const stockFilter = condition === 'outOfStock' ? { $eq: 0 } : { $gt: 0, $lte: exitThreshold };

  const candidates = await Product.find({
    userId: userObjectId,
    ...platformFilter,
    stock: stockFilter,
  })
    .select('sku name stock createdAt')
    .lean();

  if (candidates.length === 0) return [];

  const results: QueryInventoryResult[] = [];

  for (const product of candidates) {
    const daysInCondition = await daysSinceEnteredCondition(product._id, userObjectId, exitThreshold, product.createdAt);

    if (daysInCondition >= minDurationDays) {
      results.push({ sku: product.sku, name: product.name, stock: product.stock, platform, daysInCondition });
    }
  }

  return results.sort((a, b) => (b.daysInCondition ?? 0) - (a.daysInCondition ?? 0)).slice(0, MAX_RESULTS);
}
