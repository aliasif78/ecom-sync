// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Standalone seed script — NOT part of the app. Run with the -r dotenv/config
// preload flag (see the run command below) against a real (dev/staging,
// NEVER prod) database to populate dummy stores for a given user.
//
// Usage:
//   DOTENV_CONFIG_PATH=.env.local node -r dotenv/config -r tsx/cjs scripts/seed-stores.ts <userId> [count]
//
// Why not `dotenv.config()` inside this file? database/mongoose.ts reads
// process.env.MONGODB_URI at MODULE TOP-LEVEL (not inside connectDB()).
// Under ESM, all `import` statements in a file — including the import of
// @/database/mongoose — are evaluated before any of this file's own
// top-level code runs, so an in-file dotenv.config() call always executes
// too late to affect that module's already-captured constant. The -r flag
// preloads dotenv before ANY module in the graph (including
// @/database/mongoose) is loaded, which is the only ordering that works.
//
// <userId> must be a real User._id from your database — use your own dev
// account so the seeded stores show up in the actual /stores UI.
//
// [count] defaults to 25 (enough to see multiple pages at the current
// DEFAULT_STORES_PAGE_SIZE of 10).
//
// IDEMPOTENT for its own fixtures only: it deletes any prior stores whose
// `name` starts with "Seed Store" for the given user before reseeding, so
// it's safe to re-run. It does NOT touch stores you created manually
// through the UI.

import { Types } from 'mongoose';
import { faker } from '@faker-js/faker';

import { connectDB } from '@/database/mongoose';
import Store from '@/database/models/Store';
import { EPlatform } from '@/lib/globalConstants';

// ==========================================
// 💿 CONSTANTS
// ==========================================

const SEED_NAME_PREFIX = 'Seed Store';
const DEFAULT_COUNT = 25;
const CONFIGURABLE_PLATFORMS = [EPlatform.SHOPIFY, EPlatform.AMAZON, EPlatform.WOOCOMMERCE];

// ==========================================
// 🔧 HELPERS
// ==========================================

/**
 * Builds a platform-shaped `config` object matching what addStore's Zod
 * schemas (lib/stores/index.ts) expect. `uniqueSuffix` keeps storeUrl
 * unique across runs — Store has a unique partial index on
 * (userId, config.storeUrl) for Shopify/WooCommerce.
 */
function buildConfig(platform: EPlatform, uniqueSuffix: string) {
  switch (platform) {
    case EPlatform.SHOPIFY:
      return { storeUrl: `https://seed-${uniqueSuffix}.myshopify.com`, accessToken: faker.string.alphanumeric(24) };
    case EPlatform.AMAZON:
      return { apiKey: faker.string.alphanumeric(16), endpoint: faker.helpers.arrayElement(['US', 'EU']) };
    case EPlatform.WOOCOMMERCE:
      return { storeUrl: `https://seed-${uniqueSuffix}.example.com`, consumerKey: `ck_${faker.string.alphanumeric(20)}`, consumerSecret: `cs_${faker.string.alphanumeric(20)}` };
    default:
      return {};
  }
}

async function wipeExisting(userId: Types.ObjectId) {
  const result = await Store.deleteMany({ userId, name: { $regex: `^${SEED_NAME_PREFIX}` } });
  if (result.deletedCount) console.log(`🧹 Wiped ${result.deletedCount} prior seeded store(s).`);
}

// ==========================================
// 🌱 MAIN
// ==========================================

async function main() {
  const userIdArg = process.argv[2];
  const countArg = Number(process.argv[3]);
  const count = Number.isFinite(countArg) && countArg > 0 ? Math.floor(countArg) : DEFAULT_COUNT;

  if (!userIdArg) {
    console.error('❌ Usage: node -r dotenv/config -r tsx/cjs scripts/seed-stores.ts <userId> [count]');
    process.exit(1);
  }

  await connectDB();
  const userId = new Types.ObjectId(userIdArg);

  await wipeExisting(userId);

  const docs = Array.from({ length: count }).map((_, i) => {
    const platform = CONFIGURABLE_PLATFORMS[i % CONFIGURABLE_PLATFORMS.length];
    const uniqueSuffix = `${Date.now()}-${i}`;

    return {
      userId,
      platform,
      name: `${SEED_NAME_PREFIX} ${i + 1} (${platform})`,
      config: buildConfig(platform, uniqueSuffix),
      isConnected: faker.datatype.boolean({ probability: 0.7 }),
      isSyncEnabled: faker.datatype.boolean({ probability: 0.8 }),
      lastSyncAt: faker.datatype.boolean({ probability: 0.6 }) ? faker.date.recent({ days: 14 }) : null,
    };
  });

  console.log(`🚀 Inserting ${docs.length} dummy store(s) for user ${userIdArg}...`);

  for (const doc of docs) {
    await Store.create(doc);
  }

  console.log('✅ Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed script failed:', err);
  process.exit(1);
});
