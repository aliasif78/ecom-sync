// Inngest
import { inngest } from '../client';

// Database
import { connectDB } from '@/database/mongoose';
import Store from '@/database/models/Store';
import Product from '@/database/models/Product';
import { Types } from 'mongoose';

// Adapters
import { getAdapter } from '@/lib/adapters';

// Types & Constants
import { EPlatform, MUTEX_ALL } from '../../globalConstants';
import { InventoryAdapter, ProductRow, StoreRow } from '@/types';

// Utils
import { removeSyncMutex } from '../../users';
import { pusherServer } from '../../pusher';

// ==========================================
// 💿 CONSTANTS
// ==========================================

/**
 * Maps an EPlatform value to its corresponding key inside `product.mappings`.
 * MANUAL stores have no remote mapping and return null.
 */
const PLATFORM_TO_MAPPING_KEY: Partial<Record<EPlatform, 'shopify' | 'amazon' | 'woocommerce'>> = {
  [EPlatform.SHOPIFY]: 'shopify',
  [EPlatform.AMAZON]: 'amazon',
  [EPlatform.WOOCOMMERCE]: 'woocommerce',
};

// ==========================================
// 🔧 PRIVATE HELPERS
// ==========================================

/**
 * Fetches all stores for a user that are both connected and sync-enabled.
 *
 * We filter by BOTH flags:
 * - `isConnected`   — the store has passed credential validation
 * - `isSyncEnabled` — the user has explicitly opted this store into syncs
 *
 * A store that is connected but sync-disabled is intentionally excluded
 * (e.g. a store the user is setting up but not yet live).
 */
const getActiveSyncStores = async (userId: string): Promise<StoreRow[]> => {
  await connectDB();
  const results = await Store.find({ userId, isConnected: true, isSyncEnabled: true }).lean();
  // Stringify for Inngest serialization safety (ObjectIds → strings)
  return JSON.parse(JSON.stringify(results));
};

/**
 * Fetches all non-archived products for a user, selecting only the fields
 * needed by the force-sync fan-out (sku + stock).
 */
const getProductsForFanOut = async (userId: string): Promise<Pick<ProductRow, 'sku' | 'stock'>[]> => {
  await connectDB();
  const results = await Product.find({ userId }).select('sku stock').lean();
  return JSON.parse(JSON.stringify(results));
};

/**
 * Cleans up after a sync — releases the SKU mutex and pushes a Pusher
 * notification so the client UI can reflect the completed/failed state.
 */
const handleSyncCompletion = async (userId: string, sku: string, isFailure: boolean, msg?: string) => {
  await removeSyncMutex(userId, sku);
  await pusherServer.trigger(userId, 'sync-finished', {
    message: msg ?? `[${sku}] inventory sync ${isFailure ? 'failed' : 'completed'}.`,
    sku,
  });
};

/**
 * Writes the store→product mapping link into `product.mappings[platform]`
 * after a successful stock push.
 *
 * Uses `findOneAndUpdate` with atomic `$set` field-path operators instead of
 * loading and saving the full Mongoose document. This avoids optimistic
 * concurrency (version) conflicts when multiple stores sync the same product
 * in parallel inside `Promise.all`.
 *
 * First sync to a store:
 *   → calls `adapter.getProduct(sku)` to retrieve the platform-assigned ID
 *   → writes `storeId` + platform-specific ID field + `lastSyncedAt`
 *
 * Subsequent syncs (already linked):
 *   → writes only `lastSyncedAt` (storeId + platformId are already correct)
 *
 * MANUAL platform stores are skipped — they have no remote listing.
 *
 * @param sku     - Product SKU (used as lookup key alongside userId)
 * @param userId  - Owner of the product
 * @param store   - The StoreRow that just successfully synced
 * @param adapter - The adapter instance used for this sync (reused for getProduct)
 */
async function writeMappingToProduct({ sku, userId, store, adapter }: { sku: string; userId: string; store: StoreRow; adapter: InventoryAdapter }): Promise<void> {
  // Resolve which mappings slot this store's platform owns
  const mappingKey = PLATFORM_TO_MAPPING_KEY[store.platform as EPlatform];

  // MANUAL stores (or any unknown platform) have no remote listing — skip
  if (!mappingKey) {
    console.log(`ℹ️ [MAPPING] Skipping mapping write for MANUAL store "${store.name}"`);
    return;
  }

  await connectDB();

  // Check whether the product is already linked to THIS store on this platform
  const existing = await Product.findOne(
    { sku, userId: new Types.ObjectId(userId) },
    { [`mappings.${mappingKey}.storeId`]: 1 } // Only project the one field we need
  ).lean();

  if (!existing) {
    console.warn(`⚠️ [MAPPING] Product "${sku}" not found — skipping mapping write.`);
    return;
  }

  const now = new Date();

  // Build the atomic $set update. Always stamp lastSyncedAt.
  // Only write storeId + platformId on the first sync (isAlreadyLinked = false).
  const $set: Record<string, unknown> = {
    [`mappings.${mappingKey}.lastSyncedAt`]: now,
  };

  const isAlreadyLinked = !!(existing.mappings as Record<string, { storeId?: unknown }>)[mappingKey]?.storeId;

  if (!isAlreadyLinked) {
    // First sync — discover and persist the platform-assigned product ID
    console.log(`🔗 [MAPPING] First sync for "${sku}" on "${store.name}" — fetching platform ID...`);

    const remoteProduct = await adapter.getProduct(sku);

    if (!remoteProduct) {
      console.warn(`⚠️ [MAPPING] adapter.getProduct("${sku}") returned null — storeId not written.`);
      return;
    }

    // Write the FK link
    $set[`mappings.${mappingKey}.storeId`] = new Types.ObjectId(store._id);

    // Write the platform-specific ID field (different key per platform)
    if (mappingKey === 'shopify') {
      $set['mappings.shopify.variantId'] = remoteProduct.platformId;
    } else if (mappingKey === 'amazon') {
      $set['mappings.amazon.asin'] = remoteProduct.platformId;
    } else if (mappingKey === 'woocommerce') {
      $set['mappings.woocommerce.remoteId'] = remoteProduct.platformId;
    }

    console.log(`✅ [MAPPING] Linked "${sku}" → store "${store.name}" (${store.platform}) | platformId: ${remoteProduct.platformId}`);
  } else {
    console.log(`🔄 [MAPPING] "${sku}" already linked to "${store.name}" — stamping lastSyncedAt only.`);
  }

  // Single atomic write — safe to run from concurrent Inngest steps
  await Product.findOneAndUpdate(
    { sku, userId: new Types.ObjectId(userId) },
    { $set },
    { new: false } // We don't need the returned doc
  );
}

// ==========================================
// 📡 INNGEST FUNCTIONS
// ==========================================

/**
 * `verifyStoreConnection`
 *
 * Triggered by: `store/store.added`
 * Fired from:   `addStoreAction` server action (immediately after `Store.create()`)
 *
 * Flow:
 *   1. Fetch the full store document from MongoDB — including `config` (credentials),
 *      which is deliberately excluded from the public `getStoresByUserId` query.
 *   2. Instantiate the platform adapter and call `validateConnection()`.
 *      - MockAdapter has a 50% simulated failure rate here.
 *      - On failure the step THROWS so Inngest retries it (up to `retries` times).
 *        This is the key distinction: returning { success: false } is a completed
 *        step from Inngest's perspective; only a throw triggers a retry.
 *   3. Write `isConnected: true` to MongoDB (only reached after a successful validate).
 *   4. Notify the client via Pusher so `StoreTable` resolves the "Verifying…" badge.
 *
 * `onFailure`: runs when ALL retries are exhausted. Persists `isConnected: false`
 * and fires the Pusher event so the client badge still resolves cleanly.
 *
 * @param event.data.storeId - MongoDB ObjectId string of the newly created store
 * @param event.data.userId  - MongoDB ObjectId string of the owning user (Pusher channel key)
 */
export const verifyStoreConnection = inngest.createFunction(
  {
    id: 'verify-store-connection',
    triggers: [{ event: 'store/store.added' }],
    retries: 3,

    /**
     * Runs when all retry attempts are exhausted.
     * Persists the failed state and notifies the client — the "Verifying…"
     * badge must always resolve, even when every attempt fails.
     */
    onFailure: async ({ event }) => {
      const { storeId, userId } = event.data.event.data as { storeId: string; userId: string };

      await connectDB();
      await Store.findByIdAndUpdate(storeId, { isConnected: false });

      await pusherServer.trigger(userId, 'store-verified', {
        storeId,
        isConnected: false,
        message: 'Connection failed after multiple attempts. Please check your credentials.',
      });
    },
  },

  async ({ event, step }) => {
    const { storeId, userId } = event.data;

    if (!storeId || !userId) return { error: 'Missing storeId or userId in event payload' };

    // ── Step 1: Fetch full store document (config included) ──────────────────
    // We intentionally fetch the full doc here — the public-facing queries
    // exclude `.config` for security, but the adapter needs those credentials.
    const store = await step.run('fetch-store', async () => {
      await connectDB();
      const doc = await Store.findById(storeId).lean();
      // Stringify for Inngest serialization safety (ObjectIds / Dates → strings)
      return doc ? JSON.parse(JSON.stringify(doc)) : null;
    });

    if (!store) {
      // Store was deleted before the job ran — nothing to do
      console.warn(`[VERIFY] Store ${storeId} not found — may have been deleted before verification ran.`);
      return { error: 'Store not found' };
    }

    // ── Step 2: Validate credentials with the external platform ─────────────
    // IMPORTANT: we throw on failure so Inngest retries this step.
    // Simply returning { success: false } would mark the step as complete and
    // the function would proceed — retries would never fire.
    await step.run('validate-connection', async () => {
      const adapter = getAdapter(store.platform as EPlatform, store.config);
      const result = await adapter.validateConnection();

      if (!result.success) {
        // Throwing causes Inngest to retry this step with backoff.
        // The MockAdapter's 50% failure rate means this will retry ~50% of the
        // time, demonstrating per-step retry behaviour in the Inngest dashboard.
        throw new Error(`Connection validation failed: ${result.message}`);
      }
    });

    // ── Step 3: Persist isConnected: true in MongoDB ─────────────────────────
    // Only reached after a successful validateConnection() — no need to branch.
    await step.run('persist-connection-status', async () => {
      await connectDB();
      await Store.findByIdAndUpdate(storeId, { isConnected: true });
    });

    // ── Step 4: Notify the client via Pusher ─────────────────────────────────
    // `StoreTable` subscribes to this event and resolves the "Verifying…" badge.
    await step.run('notify-client', async () => {
      await pusherServer.trigger(userId, 'store-verified', {
        storeId,
        isConnected: true,
        message: 'Store connected successfully.',
      });
    });

    console.log(`[VERIFY] Store ${storeId} → isConnected: true`);
    return { storeId, isConnected: true };
  }
);

/**
 * `syncStockToStores`
 *
 * Triggered by: `inventory/stock.updated`
 * Fired from:   `syncProductStock` server action (after internal DB write)
 *
 * Flow:
 *   1. Fetch all active (connected + sync-enabled) stores for the user
 *   2. Fan-out: one Inngest step per store, run in parallel
 *   3. Each step:
 *        a. Calls `adapter.updateStock()` → pushes the new quantity to the platform
 *        b. Calls `writeMappingToProduct()` → persists the store→product link in MongoDB
 *   4. Cleanup: release mutex, fire Pusher notification
 *
 * Retries: Inngest retries failing steps individually (not the whole function),
 * so a Shopify timeout does NOT re-run the already-successful Amazon step.
 */
export const syncStockToStores = inngest.createFunction(
  {
    id: 'sync-stock-to-stores',
    triggers: [{ event: 'inventory/stock.updated' }],
    concurrency: 5, // Inngest free tier maximum
    throttle: { limit: 10, period: '1m', key: 'event.data.userId' }, // Per-user rate limit
    retries: 3,

    // 🛡️ Ensure the SKU mutex is always released, even if all retries fail
    onFailure: async ({ event }) => {
      const { sku, userId } = event.data.event.data as { sku: string; userId: string };
      await handleSyncCompletion(userId, sku, true);
    },
  },

  async ({ event, step }) => {
    const { sku, quantity, userId } = event.data;

    if (!userId || !sku || quantity === undefined) return { error: 'Missing required event data' };

    try {
      // ── Step 1: Resolve sync targets ────────────────────────────────────────
      const stores = await step.run('fetch-active-stores', () => getActiveSyncStores(userId));

      if (stores.length === 0) {
        console.log(`ℹ️ [SYNC] No active stores for user ${userId} — releasing mutex.`);
        // Still need to release the mutex even with no stores to sync
        await step.run('cleanup-and-notify', () => handleSyncCompletion(userId, sku, false, `[${sku}] No active stores to sync.`));
        return { message: 'No active stores to sync.', sku };
      }

      // ── Step 2: Fan-out — one step per store ─────────────────────────────────
      // Each step is independently retried by Inngest on failure.
      // Steps run in parallel via Promise.all.
      const syncResults = await Promise.all(
        stores.map((store: StoreRow) =>
          step.run(`sync-${store.platform}-${store._id}`, async () => {
            // A. Instantiate the correct adapter for this store's platform
            const adapter = getAdapter(store.platform as EPlatform, store.config);

            // B. Push the stock update to the external platform
            await adapter.updateStock(sku, quantity);

            // C. Persist the store→product link in MongoDB.
            //    Uses atomic $set — safe to call from concurrent steps.
            await writeMappingToProduct({ sku, userId, store, adapter });

            return {
              store: store.name,
              platform: store.platform,
              status: 'success' as const,
            };
          })
        )
      );

      // ── Step 3: Cleanup ──────────────────────────────────────────────────────
      await step.run('cleanup-and-notify', () => handleSyncCompletion(userId, sku, false));

      return { message: 'Sync complete', sku, results: syncResults };
    } catch (error) {
      console.error('[SYNC] Unexpected error in syncStockToStores:', error);
      throw new Error(`syncStockToStores failed for SKU "${sku}": ${error}`);
    }
  }
);

/**
 * `forceSyncAllStores`
 *
 * Triggered by: `inventory/force.sync.all`
 * Fired from:   `forceSyncAllProducts` server action
 *
 * Instead of processing all products in one long-running function (memory risk),
 * this dispatches one `inventory/stock.updated` event per product into the
 * Inngest queue and immediately exits. Each product is then processed by
 * `syncStockToStores` independently, with its own retry budget.
 */
export const forceSyncAllStores = inngest.createFunction(
  {
    id: 'force-sync-all-stores',
    concurrency: 1, // Prevent concurrent force-syncs for the same user
    triggers: [{ event: 'inventory/force.sync.all' }],
  },

  async ({ event, step }) => {
    const { userId } = event.data;

    try {
      // ── Step 1: Fetch all product SKUs + stock levels ────────────────────────
      const products = await step.run('fetch-db-products', () => getProductsForFanOut(userId));

      if (products.length === 0) return { message: 'No products found' };

      // ── Step 2: Dispatch — fire one event per product ─────────────────────────
      // We do NOT await each sync here. We fire all events into the Inngest queue
      // and close this function immediately. This avoids memory pressure from
      // holding thousands of open promises.
      await step.run('dispatch-sync-events', async () => {
        const events = products.map((p) => ({
          name: 'inventory/stock.updated' as const,
          data: { sku: p.sku, quantity: p.stock, userId },
        }));

        await inngest.send(events);
      });

      // ── Step 3: Release the global mutex ─────────────────────────────────────
      await step.run('clear-global-lock', () => handleSyncCompletion(userId, MUTEX_ALL, false, 'All products dispatched for sync!'));

      return { message: 'Force sync dispatched', productCount: products.length };
    } catch (error) {
      console.error('[FORCE_SYNC] Unexpected error in forceSyncAllStores:', error);
      throw new Error(`forceSyncAllStores failed: ${error}`);
    }
  }
);
