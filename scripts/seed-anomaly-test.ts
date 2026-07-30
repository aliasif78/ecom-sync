// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Phase 2 checkpoint. Seeds known-bad data for all 5 anomaly detectors, one
// deliberately-triggering case per severity tier where a detector has tiers,
// plus one deliberately NON-triggering case per detector to catch false
// positives. Run test-anomaly-detectors.ts against this same userId after.
//
// Usage:
//   node -r dotenv/config -r tsx/cjs scripts/seed-anomaly-test.ts <userId>

import { Types } from 'mongoose';

import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';
import Store from '@/database/models/Store';
import InventoryLedger from '@/database/models/InventoryLedger';
import { DEF_LOC_ID } from '@/lib/globalConstants';
import { EPlatform } from '@/lib/globalConstants';
import { InventoryReason } from '@/types';

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysAgo(d: number): Date {
  return hoursAgo(d * 24);
}

async function main() {
  const userIdArg = process.argv[2];

  if (!userIdArg) {
    console.error('❌ Usage: node -r dotenv/config -r tsx/cjs scripts/seed-anomaly-test.ts <userId>');
    process.exit(1);
  }

  const userId = new Types.ObjectId(userIdArg);
  await connectDB();

  // -----------------------------------------------------------------------
  // 0) CLEANUP — makes this script safely rerunnable against the same
  //    userId. Necessary because Product.sku has a GLOBAL unique index
  //    (not scoped to userId), so a second run without this would fail on
  //    the first duplicate ANOM-* sku rather than refreshing the fixtures.
  // -----------------------------------------------------------------------
  console.log('🧹 Removing any previous anomaly test fixtures for this user...');

  const staleProducts = await Product.find({ userId, sku: { $regex: '^ANOM-' } }).select('_id');
  const staleProductIds = staleProducts.map((p) => p._id);
  if (staleProductIds.length) {
    await InventoryLedger.deleteMany({ productId: { $in: staleProductIds } });
    await Product.deleteMany({ _id: { $in: staleProductIds } });
  }

  const staleStores = await Store.find({ userId, name: { $regex: '^Anomaly Test Store:' } }).select('_id');
  const staleStoreIds = staleStores.map((s) => s._id);
  if (staleStoreIds.length) {
    await Store.deleteMany({ _id: { $in: staleStoreIds } });
  }

  // -----------------------------------------------------------------------
  // 1) STOCK DROP
  // -----------------------------------------------------------------------

  // 1a) TRIGGER — MEDIUM severity (40% drop, within the 24h window)
  const productDropMedium = await Product.create({
    userId,
    sku: 'ANOM-DROP-MED',
    name: 'Anomaly Test: Medium Stock Drop',
    price: 19.99,
    image: 'https://loremflickr.com/320/240',
    stock: 35,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 35 }],
    mappings: {},
  });
  await InventoryLedger.create({
    productId: productDropMedium._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 100,
    newStock: 35,
    platform: EPlatform.SHOPIFY,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: 65% drop — safely inside the [0.5, 0.75) MEDIUM band, should trigger MEDIUM',
    createdAt: hoursAgo(3),
  });

  // 1b) TRIGGER — HIGH severity (90% drop)
  const productDropHigh = await Product.create({
    userId,
    sku: 'ANOM-DROP-HIGH',
    name: 'Anomaly Test: High Stock Drop',
    price: 19.99,
    image: 'https://loremflickr.com/320/240',
    stock: 5,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 5 }],
    mappings: {},
  });
  await InventoryLedger.create({
    productId: productDropHigh._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 50,
    newStock: 5,
    platform: EPlatform.AMAZON,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: 90% drop, should trigger HIGH',
    createdAt: hoursAgo(1),
  });

  // 1c) NON-TRIGGER — drop is real but below both bars (small % on a big base)
  const productDropNone = await Product.create({
    userId,
    sku: 'ANOM-DROP-NONE',
    name: 'Anomaly Test: Non-Triggering Drop',
    price: 19.99,
    image: 'https://loremflickr.com/320/240',
    stock: 995,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 995 }],
    mappings: {},
  });
  await InventoryLedger.create({
    productId: productDropNone._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 1000,
    newStock: 995,
    platform: EPlatform.SHOPIFY,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: 0.5% drop, should NOT trigger',
    createdAt: hoursAgo(2),
  });

  // 1d) NON-TRIGGER — big % drop but outside the 24h window (stale)
  const productDropStale = await Product.create({
    userId,
    sku: 'ANOM-DROP-STALE',
    name: 'Anomaly Test: Stale Drop (outside window)',
    price: 19.99,
    image: 'https://loremflickr.com/320/240',
    stock: 10,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 10 }],
    mappings: {},
  });
  await InventoryLedger.create({
    productId: productDropStale._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 100,
    newStock: 10,
    platform: EPlatform.SHOPIFY,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: 90% drop but 48h old — should NOT trigger (outside 24h window)',
    createdAt: hoursAgo(48),
  });

  // -----------------------------------------------------------------------
  // 2) NEGATIVE STOCK
  // -----------------------------------------------------------------------

  // 2a) TRIGGER — MEDIUM (-5, between -3 and -10)
  await Product.create({
    userId,
    sku: 'ANOM-NEG-MED',
    name: 'Anomaly Test: Medium Negative Stock',
    price: 9.99,
    image: 'https://loremflickr.com/320/240',
    stock: -5,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: -5 }],
    mappings: {},
  });

  // 2b) TRIGGER — HIGH (-15)
  await Product.create({
    userId,
    sku: 'ANOM-NEG-HIGH',
    name: 'Anomaly Test: High Negative Stock',
    price: 9.99,
    image: 'https://loremflickr.com/320/240',
    stock: -15,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: -15 }],
    mappings: {},
  });

  // 2c) NON-TRIGGER — 0 stock is not negative
  await Product.create({
    userId,
    sku: 'ANOM-NEG-NONE',
    name: 'Anomaly Test: Zero Stock (not negative)',
    price: 9.99,
    image: 'https://loremflickr.com/320/240',
    stock: 0,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 0 }],
    mappings: {},
  });

  // -----------------------------------------------------------------------
  // 3) SYNC DRIFT
  // -----------------------------------------------------------------------

  // 3a) TRIGGER — MEDIUM (24h drift: lastSyncAt 30h ago, activity 6h ago)
  const storeDriftMedium = await Store.create({
    userId,
    platform: EPlatform.SHOPIFY,
    name: 'Anomaly Test Store: Medium Drift',
    config: { storeUrl: 'https://anom-drift-medium.myshopify.com' },
    isConnected: true,
    isSyncEnabled: true,
    lastSyncAt: hoursAgo(30),
  });
  const productDriftMedium = await Product.create({
    userId,
    sku: 'ANOM-DRIFT-MED',
    name: 'Anomaly Test: Product for Medium Drift',
    price: 14.99,
    image: 'https://loremflickr.com/320/240',
    stock: 40,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 40 }],
    mappings: { shopify: { storeId: storeDriftMedium._id, variantId: 'gid://shopify/ProductVariant/anom-1' } },
  });
  await InventoryLedger.create({
    productId: productDriftMedium._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 45,
    newStock: 40,
    platform: EPlatform.SHOPIFY,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: activity 6h ago vs. lastSyncAt 30h ago — 24h drift, should trigger MEDIUM',
    createdAt: hoursAgo(6),
  });

  // 3b) NON-TRIGGER — synced recently, no drift
  const storeDriftNone = await Store.create({
    userId,
    platform: EPlatform.SHOPIFY,
    name: 'Anomaly Test Store: No Drift',
    config: { storeUrl: 'https://anom-drift-none.myshopify.com' },
    isConnected: true,
    isSyncEnabled: true,
    lastSyncAt: hoursAgo(1),
  });
  const productDriftNone = await Product.create({
    userId,
    sku: 'ANOM-DRIFT-NONE',
    name: 'Anomaly Test: Product for No Drift',
    price: 14.99,
    image: 'https://loremflickr.com/320/240',
    stock: 40,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 40 }],
    mappings: { shopify: { storeId: storeDriftNone._id, variantId: 'gid://shopify/ProductVariant/anom-2' } },
  });
  await InventoryLedger.create({
    productId: productDriftNone._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 45,
    newStock: 40,
    platform: EPlatform.SHOPIFY,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: activity 2h ago vs. lastSyncAt 1h ago — should NOT trigger',
    createdAt: hoursAgo(2),
  });

  // -----------------------------------------------------------------------
  // 4) STORE STATE CONTRADICTION
  // -----------------------------------------------------------------------

  // 4a) TRIGGER
  await Store.create({
    userId,
    platform: EPlatform.WOOCOMMERCE,
    name: 'Anomaly Test Store: Contradiction',
    config: { storeUrl: 'https://anom-contradiction.example.com' },
    isConnected: false,
    isSyncEnabled: true,
  });

  // 4b) NON-TRIGGER — disabled AND disconnected is a normal, intentional state
  await Store.create({
    userId,
    platform: EPlatform.WOOCOMMERCE,
    name: 'Anomaly Test Store: Intentionally Disabled',
    config: { storeUrl: 'https://anom-disabled.example.com' },
    isConnected: false,
    isSyncEnabled: false,
  });

  // -----------------------------------------------------------------------
  // 5) STOCKOUT RISK
  // -----------------------------------------------------------------------

  // 5a) TRIGGER — HIGH (velocity ~10.36/day across 3 distinct orders, stock 5 → ~0.48 days remaining)
  // Split into 3 separate orders (not 1) — detectStockoutRisk now requires
  // a minimum number of distinct sale events before trusting a velocity
  // figure at all (see detectors.ts's correction note). A single big order
  // is too small a sample to extrapolate into a sustained daily rate.
  const productRiskHigh = await Product.create({
    userId,
    sku: 'ANOM-RISK-HIGH',
    name: 'Anomaly Test: High Stockout Risk',
    price: 24.99,
    image: 'https://loremflickr.com/320/240',
    stock: 5,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 5 }],
    mappings: {},
  });
  await InventoryLedger.create([
    { productId: productRiskHigh._id, userId, locationId: DEF_LOC_ID, oldStock: 150, newStock: 100, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: order 1 of 3', createdAt: daysAgo(10) },
    { productId: productRiskHigh._id, userId, locationId: DEF_LOC_ID, oldStock: 100, newStock: 50, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: order 2 of 3', createdAt: daysAgo(7) },
    { productId: productRiskHigh._id, userId, locationId: DEF_LOC_ID, oldStock: 50, newStock: 5, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: order 3 of 3 — 145 total units sold over 10 days across 3 orders → velocity ~10.36/day, stock 5 → ~0.48 days remaining', createdAt: daysAgo(4) },
  ]);

  // 5b) NON-TRIGGER — same total velocity, but plenty of stock. Also
  // spread across 3 orders for consistency, though this fixture's
  // non-trigger status comes from healthy stock, not order count.
  const productRiskNone = await Product.create({
    userId,
    sku: 'ANOM-RISK-NONE',
    name: 'Anomaly Test: Healthy Stock, High Velocity',
    price: 24.99,
    image: 'https://loremflickr.com/320/240',
    stock: 500,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 500 }],
    mappings: {},
  });
  await InventoryLedger.create([
    { productId: productRiskNone._id, userId, locationId: DEF_LOC_ID, oldStock: 640, newStock: 595, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: order 1 of 3', createdAt: daysAgo(10) },
    { productId: productRiskNone._id, userId, locationId: DEF_LOC_ID, oldStock: 595, newStock: 550, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: order 2 of 3', createdAt: daysAgo(7) },
    { productId: productRiskNone._id, userId, locationId: DEF_LOC_ID, oldStock: 550, newStock: 500, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: order 3 of 3 — same ~10/day velocity, but 500 in stock → 50 days remaining, should NOT trigger', createdAt: daysAgo(4) },
  ]);

  // 5c) NON-TRIGGER — single order only. Otherwise identical math to 5a
  // (same total quantity, same resulting velocity/days-remaining), but only
  // ONE distinct order — this is what should get caught by
  // STOCKOUT_RISK_MIN_ORDER_COUNT specifically. Isolates that rule directly,
  // rather than relying on incidental overlap with STOCK_DROP's fixtures.
  const productRiskSingleOrder = await Product.create({
    userId,
    sku: 'ANOM-RISK-SINGLE-ORDER',
    name: 'Anomaly Test: Single Large Order (should not imply sustained velocity)',
    price: 24.99,
    image: 'https://loremflickr.com/320/240',
    stock: 5,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 5 }],
    mappings: {},
  });
  await InventoryLedger.create({
    productId: productRiskSingleOrder._id,
    userId,
    locationId: DEF_LOC_ID,
    oldStock: 150,
    newStock: 5,
    platform: EPlatform.SHOPIFY,
    reason: InventoryReason.ORDER_FULFILLMENT,
    description: 'seed: identical math to 5a (145 sold, stock 5, ~0.48 days remaining) but as ONE order — should NOT trigger under STOCKOUT_RISK_MIN_ORDER_COUNT',
    createdAt: daysAgo(4),
  });
  console.log('✅ Seeded anomaly test data for all 5 detector types.');
  console.log('Expected outcomes:');
  console.log('  STOCK_DROP:        ANOM-DROP-MED (65% drop → MEDIUM), ANOM-DROP-HIGH (90% drop → HIGH). NOT: ANOM-DROP-NONE, ANOM-DROP-STALE.');
  console.log('  NEGATIVE_STOCK:    ANOM-NEG-MED (MEDIUM), ANOM-NEG-HIGH (HIGH). NOT: ANOM-NEG-NONE.');
  console.log('  SYNC_DRIFT:        store "Medium Drift" (MEDIUM). NOT: store "No Drift".');
  console.log('  STORE_CONTRADICTION: store "Contradiction". NOT: store "Intentionally Disabled".');
  console.log('  STOCKOUT_RISK:     ANOM-RISK-HIGH (3 orders, ~0.48 days remaining → HIGH). NOT: ANOM-RISK-NONE (healthy stock), ANOM-RISK-SINGLE-ORDER (only 1 order — same math as ANOM-RISK-HIGH but fails the minimum-order-count rule).');
  console.log('  NOTE: ANOM-DROP-HIGH and ANOM-DROP-STALE will also NOT appear under STOCKOUT_RISK — each has only 1 qualifying order, same reason as ANOM-RISK-SINGLE-ORDER. This was the real false positive caught in Phase 4.');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed script failed:', err);
  process.exit(1);
});
