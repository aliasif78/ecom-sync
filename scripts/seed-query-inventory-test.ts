// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Standalone seed script — NOT part of the app. Run with tsx against a real
// (dev/staging, never prod) database to create known test scenarios for
// verifying `queryInventory` logic in Phase 1, before any AI layer exists.
//
// Usage:
//   tsx scripts/seed-query-inventory-test.ts <userId>
//
// <userId> must be a real User._id from your database — use your own dev
// account so you can later verify these products show up correctly in the
// actual /products UI and through the real Copilot end-to-end.
//
// This script is IDEMPOTENT: it deletes any prior TEST-A..E products/ledger
// entries for the given user before reseeding, so it's safe to re-run.
//
// ⚠️ Adjust the `@/` import paths below if your tsx setup doesn't resolve
// them the same way your other standalone scripts (e.g. the Week 4/5
// ingestion scripts) already do — match whatever pattern those use.

// ==========================================
// 📦 Imports
// ==========================================

import { Types } from 'mongoose';
import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';
import InventoryLedger from '@/database/models/InventoryLedger';
import { EPlatform, DEF_LOC_ID } from '@/lib/globalConstants';
import { InventoryReason } from '@/types';

// ==========================================
// 💿 CONSTANTS
// ==========================================

const TEST_SKUS = ['TEST-A', 'TEST-B', 'TEST-C', 'TEST-D', 'TEST-E'];
const DAY = 1000 * 60 * 60 * 24;

// ==========================================
// 🔧 HELPERS
// ==========================================

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY);
}

async function wipeExisting(userId: Types.ObjectId) {
  const existing = await Product.find({ userId, sku: { $in: TEST_SKUS } }).select('_id');
  const ids = existing.map((p) => p._id);

  if (ids.length) {
    await InventoryLedger.deleteMany({ productId: { $in: ids } });
    await Product.deleteMany({ _id: { $in: ids } });
    console.log(`🧹 Wiped ${ids.length} prior test product(s).`);
  }
}

// ==========================================
// 🌱 SEED SCENARIOS
// ==========================================

async function main() {
  const userIdArg = process.argv[2];

  if (!userIdArg) {
    console.error('❌ Usage: tsx scripts/seed-query-inventory-test.ts <userId>');
    process.exit(1);
  }

  await connectDB();
  const userId = new Types.ObjectId(userIdArg);

  await wipeExisting(userId);

  const fakeAmazonStoreId = new Types.ObjectId();

  // -----------------------------------------------------------------------
  // Product A — Out of stock 5 days, Amazon-mapped, no recovery since.
  // Expect: matches outOfStock(platform=amazon, minDurationDays<=5), NOT minDurationDays=6+
  // -----------------------------------------------------------------------
  const productA = await Product.create({
    userId,
    sku: 'TEST-A',
    name: 'Test Product A (5d out of stock, Amazon)',
    price: 19.99,
    image: 'https://loremflickr.com/320/240',
    stock: 0,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 0 }],
    mappings: { amazon: { storeId: fakeAmazonStoreId, asin: 'FAKEASIN0001', syncStatus: 'IDLE' } },
    createdAt: daysAgo(30),
  });

  await InventoryLedger.create([
    { productId: productA._id, userId, locationId: DEF_LOC_ID, oldStock: 0, newStock: 8, platform: EPlatform.MANUAL, reason: InventoryReason.INITIAL_COUNT, description: 'seed', createdAt: daysAgo(10) },
    { productId: productA._id, userId, locationId: DEF_LOC_ID, oldStock: 8, newStock: 0, platform: EPlatform.AMAZON, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: dropped to 0', createdAt: daysAgo(5) },
  ]);

  // -----------------------------------------------------------------------
  // Product B — Out of stock 1 day, Amazon-mapped.
  // Expect: matches outOfStock(platform=amazon, minDurationDays<=1), NOT minDurationDays=3
  // -----------------------------------------------------------------------
  const productB = await Product.create({
    userId,
    sku: 'TEST-B',
    name: 'Test Product B (1d out of stock, Amazon)',
    price: 24.99,
    image: 'https://loremflickr.com/320/240',
    stock: 0,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 0 }],
    mappings: { amazon: { storeId: fakeAmazonStoreId, asin: 'FAKEASIN0002', syncStatus: 'IDLE' } },
    createdAt: daysAgo(30),
  });

  await InventoryLedger.create([
    { productId: productB._id, userId, locationId: DEF_LOC_ID, oldStock: 0, newStock: 8, platform: EPlatform.MANUAL, reason: InventoryReason.INITIAL_COUNT, description: 'seed', createdAt: daysAgo(10) },
    { productId: productB._id, userId, locationId: DEF_LOC_ID, oldStock: 8, newStock: 0, platform: EPlatform.AMAZON, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: dropped to 0', createdAt: daysAgo(1) },
  ]);

  // -----------------------------------------------------------------------
  // Product C — Recovered 2 days ago, then relapsed to 0 yesterday.
  // The FIRST time it hit 0 was 5 days ago, but it recovered — the current
  // streak is only ~1 day. This is the case that breaks a naive
  // "first time it ever hit zero" implementation.
  // Expect: matches outOfStock(minDurationDays<=1), must NOT match minDurationDays=3+
  // (a wrong implementation would incorrectly show 5 days here)
  // -----------------------------------------------------------------------
  const productC = await Product.create({
    userId,
    sku: 'TEST-C',
    name: 'Test Product C (relapsed 1d ago, previously out 5d ago)',
    price: 14.99,
    image: 'https://loremflickr.com/320/240',
    stock: 0,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 0 }],
    mappings: { amazon: { storeId: fakeAmazonStoreId, asin: 'FAKEASIN0003', syncStatus: 'IDLE' } },
    createdAt: daysAgo(30),
  });

  await InventoryLedger.create([
    { productId: productC._id, userId, locationId: DEF_LOC_ID, oldStock: 0, newStock: 8, platform: EPlatform.MANUAL, reason: InventoryReason.INITIAL_COUNT, description: 'seed', createdAt: daysAgo(10) },
    { productId: productC._id, userId, locationId: DEF_LOC_ID, oldStock: 8, newStock: 0, platform: EPlatform.AMAZON, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: first drop', createdAt: daysAgo(5) },
    { productId: productC._id, userId, locationId: DEF_LOC_ID, oldStock: 0, newStock: 8, platform: EPlatform.MANUAL, reason: InventoryReason.RECEIVED_INVENTORY, description: 'seed: recovery', createdAt: daysAgo(2) },
    { productId: productC._id, userId, locationId: DEF_LOC_ID, oldStock: 8, newStock: 0, platform: EPlatform.AMAZON, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: relapse', createdAt: daysAgo(1) },
  ]);

  // -----------------------------------------------------------------------
  // Product D — Shopify only, NOT mapped to Amazon, low stock (3 units).
  // Expect: excluded from any platform=amazon query, INCLUDED in lowStock(platform=all)
  // -----------------------------------------------------------------------
  const fakeShopifyStoreId = new Types.ObjectId();

  const productD = await Product.create({
    userId,
    sku: 'TEST-D',
    name: 'Test Product D (Shopify only, low stock)',
    price: 9.99,
    image: 'https://loremflickr.com/320/240',
    stock: 3,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 3 }],
    mappings: { shopify: { storeId: fakeShopifyStoreId, variantId: 'gid://shopify/ProductVariant/999' } },
    createdAt: daysAgo(30),
  });

  await InventoryLedger.create([
    { productId: productD._id, userId, locationId: DEF_LOC_ID, oldStock: 0, newStock: 15, platform: EPlatform.MANUAL, reason: InventoryReason.INITIAL_COUNT, description: 'seed', createdAt: daysAgo(10) },
    { productId: productD._id, userId, locationId: DEF_LOC_ID, oldStock: 15, newStock: 3, platform: EPlatform.SHOPIFY, reason: InventoryReason.ORDER_FULFILLMENT, description: 'seed: down to low stock', createdAt: daysAgo(4) },
  ]);

  // -----------------------------------------------------------------------
  // Product E — Healthy stock (25 units), for stockAbove/stockBelow tests.
  // -----------------------------------------------------------------------
  await Product.create({
    userId,
    sku: 'TEST-E',
    name: 'Test Product E (healthy stock)',
    price: 29.99,
    image: 'https://loremflickr.com/320/240',
    stock: 25,
    inventoryByLocation: [{ locationId: DEF_LOC_ID, quantity: 25 }],
    mappings: {},
    createdAt: daysAgo(30),
  });

  console.log('✅ Seeded 5 test products (TEST-A through TEST-E) with ledger history.');
  console.log('Expected outcomes:');
  console.log('  TEST-A: outOfStock, amazon, ~5 days continuous');
  console.log('  TEST-B: outOfStock, amazon, ~1 day continuous');
  console.log('  TEST-C: outOfStock, amazon, ~1 day continuous (NOT 5 — relapse case)');
  console.log('  TEST-D: excluded from platform=amazon queries; lowStock(platform=all) match, stock=3');
  console.log('  TEST-E: stockAbove(threshold=20) match, stock=25');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed script failed:', err);
  process.exit(1);
});
