// Inngest
import { inngest } from '../client';

// Database
import { connectDB } from '@/database/mongoose';
import Store from '@/database/models/Store';
import Product from '@/database/models/Product';

// Adapters
import { getAdapter } from '@/lib/adapters';

// Types
import { EPlatform, MUTEX_ALL } from '../../globalConstants';
import { ProductRow, StoreRow } from '@/types';

// Utils
import { removeSyncMutex } from '../../users';
import { pusherServer } from '../../pusher';

// Helper Functions
// The Risk: Inngest works by "replaying" your function. On replay, it expects the same code to run. If you change the internal logic of getProducts later, the replay might behave unexpectedly.
// Fix: Ensure those helper functions are purely for data fetching and don't contain side effects.
const getStores = async (userId: string, { isSyncEnabled }: { isSyncEnabled?: boolean }) => {
  // 1. Establish DB connection
  await connectDB();

  // 2. Get sync enabled stores - We use .lean() for performance and JSON serialization
  const query = isSyncEnabled ? { isSyncEnabled: true } : {};
  const results = await Store.find({ userId, ...query }).lean();

  // 3. Convert to JSON
  return JSON.parse(JSON.stringify(results));
};

const getProducts = async (userId: string, selectFields: string) => {
  // 1. Establish DB connection
  await connectDB();

  // 2. Get all products, with select fields
  const res = await Product.find({ userId })
    .select(selectFields || '')
    .lean();

  // 3. Convert to JSON
  return JSON.parse(JSON.stringify(res));
};

const handleSyncCompletion = async (userId: string, sku: string, isFailure: boolean, msg?: string) => {
  await removeSyncMutex(userId, sku);
  await pusherServer.trigger(userId, 'sync-finished', { message: msg || `[${sku}] inventory sync ${isFailure ? 'failed' : 'completed'}.`, sku });
};

// Inngest Functions
export const syncStockToStores = inngest.createFunction(
  // 🛡️ THROTTLE: Only allow 10 syncs per minute per user - This is better than concurrency for API rate limits
  {
    id: 'sync-stock-to-stores',
    triggers: [{ event: 'inventory/stock.updated' }],
    concurrency: 5, // Max is 5 for inngest's free tier
    throttle: { limit: 10, period: '1m', key: 'event.data.userId' },
    retries: 3,

    // 🛡️ Ensure lock is cleared even if all retries fail!
    onFailure: async ({ event }) => {
      const { sku, userId } = event.data.event.data as { sku: string; userId: string };
      handleSyncCompletion(userId, sku, true);
    },
  },

  async ({ event, step }) => {
    // 1. Extract data
    const { sku, quantity, userId } = event.data;

    // 2. Validation
    if (!userId || !sku || quantity === undefined) return { error: 'Missing SKU or Quantity' };

    try {
      // 3. Fetch Active Stores (The "Target List")
      const stores = await step.run('fetch-active-stores', () => getStores(userId, { isSyncEnabled: true }));

      // 4. Check if there are any stores to sync
      if (stores.length === 0) return { message: 'No active stores to sync.', sku };

      // 5. Fan-Out - Sync all stores ⚔️
      // We launch a separate step for EACH store
      // Run all syncs in parallel
      const syncResults = await Promise.all(
        stores.map((store: StoreRow) => {
          // Sync the store
          return step.run(`sync-${store.platform}-${store._id}`, async () => {
            try {
              // A. Wake up the specific adapter (Mock, Shopify, etc.)
              const adapter = getAdapter(store.platform as EPlatform, store.config);

              // B. Push the update
              const result = await adapter.updateStock(sku, quantity);

              // C. Success response
              return { store: store.name, status: 'success', message: result.message };
            } catch (error) {
              // D. Throw error so Inngest auto-retries ONLY this store
              throw new Error(`Failed to sync ${store.name}: ${error}`);
            }
          });

          // return { store: store.name, status: 'success', message: `Sync started for store ${store.name}...` };
        })
      );

      // 🛡️ Wrap external side-effects in a step so they only happen ONCE
      await step.run('cleanup-and-notify', async () => handleSyncCompletion(userId, sku, false));

      // 6. Return final results
      return { message: 'Sync Complete', sku, results: syncResults };
    } catch (error) {
      console.error(error);
      throw new Error('ERROR IN SYNCING SINGLE PRODUCT');
    }
  }
);

export const forceSyncAllStores = inngest.createFunction(
  {
    id: 'force-sync-all-stores',
    concurrency: 1, // 🛡️ Prevent the system from doing 100 force syncs at once
    triggers: [{ event: 'inventory/force.sync.all' }],
  },

  async ({ event, step }) => {
    // 1. Extract data
    const { userId } = event.data;

    try {
      // 2. Get the sku & quantity of all products from Mongo DB
      const products = await step.run('fetch-db-products', () => getProducts(userId, 'sku stock'));

      // 3. Presense check
      if (products.length === 0) return { message: 'No products found' };

      // 4 "Fan-Out" via Events, not Invokes.
      // Instead of waiting for 1,000 functions to finish (Memory Crash), we fire 1,000 events into the queue and instantly close this function.
      await step.run('dispatch-sync-events', async () => {
        const eventsToFire = products.map((p: ProductRow) => ({ name: 'inventory/stock.updated', data: { sku: p.sku, quantity: p.stock, userId } }));

        // Inngest can handle sending huge arrays of events efficiently
        await inngest.send(eventsToFire);
      });

      // 🛡️ Clear the MUTEX_ALL lock so the user can use their app again!
      await step.run('clear-global-lock', async () => handleSyncCompletion(userId, MUTEX_ALL, false, 'All products dispatched for sync!'));

      // 5. Return final results
      return { message: 'Force Sync Complete', productCount: products.length };
    } catch (error) {
      console.error(error);
      throw new Error('ERROR IN FORCE SYNCING ALL PRODUCTS');
    }
  }
);
