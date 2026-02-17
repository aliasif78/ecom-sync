// Inngest
import { inngest } from './client';

// Database
import { connectDB } from '@/database/mongoose';
import Store from '@/database/models/Store';
import Product from '@/database/models/Product';

// Adapters
import { getAdapter } from '@/lib/adapters';

// Types
import { ProductRow } from '@/types';
import { EPlatform } from '../globalConstants';

// Utils
import { setSyncMutex } from '../users';
import { pusherServer } from '../pusher';

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

// Inngest Functions
export const syncStockToStores = inngest.createFunction(
  // 🛡️ THROTTLE: Only allow 10 syncs per minute per user - This is better than concurrency for API rate limits
  { id: 'sync-stock-to-stores', concurrency: 10, throttle: { limit: 10, period: '1m', key: 'event.data.userId' } },
  { event: 'inventory/stock.updated' },

  async ({ event, step }) => {
    // 1. Extract data
    const { sku, quantity, userId, isForced } = event.data;

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
      const syncResults = [];

      for (const store of stores) {
        // Sync the store
        const result = await step.run(`sync-${store.platform}-${store._id}`, async () => {
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

        // Add to results
        syncResults.push(result);
      }

      // 6. Return final results
      return { message: 'Sync Complete', sku, results: syncResults };
    } catch (error) {
      console.error(error);
      throw new Error('ERROR IN SYNCING SINGLE PRODUCT');
    } finally {
      // Release the mutex
      if (!isForced) await step.run('release-lock', () => setSyncMutex(userId, false));

      // 📣 Tell the UI the work is done - We use the userId as the channel name so we only notify THIS user
      await pusherServer.trigger(`user-${userId}`, 'sync-finished', { message: 'Inventory sync complete' });
    }
  }
);

export const forceSyncAllStores = inngest.createFunction(
  { id: 'force-sync-all-stores', concurrency: 1 }, // 🛡️ Prevent the system from doing 100 force syncs at once
  { event: 'inventory/force.sync.all' },

  async ({ event, step }) => {
    // 1. Extract data
    const { userId } = event.data;

    try {
      // 2. Get the sku & quantity of all products from Mongo DB
      const products = await step.run('fetch-db-products', () => getProducts(userId, 'sku stock'));

      // 3. Presense check
      if (products.length === 0) return { message: 'No products found' };

      // 4. Reuse the individual product sync function for all products
      // We loop through products and INVOKE the sync function for each.
      // We use Promise.all to run them in parallel (up to the concurrency limits you set).
      await Promise.all(products.map((p: ProductRow) => step.invoke(`sync-product-${p.sku}`, { function: syncStockToStores, data: { sku: p.sku, quantity: p.stock, userId, isForced: true } })));

      // 5. Release the mutex
      await step.run('release-lock', () => setSyncMutex(userId, false));

      // 6. Return final results
      return { message: 'Force Sync Complete', productCount: products.length };
    } catch (error) {
      console.error(error);
      throw new Error('ERROR IN FORCE SYNCING ALL PRODUCTS');
    } finally {
      // Release the mutex
      await step.run('release-lock', () => setSyncMutex(userId, false));

      // 📣 Tell the UI the work is done - We use the userId as the channel name so we only notify THIS user
      await pusherServer.trigger(`user-${userId}`, 'sync-finished', { message: 'Inventory sync complete' });
    }
  }
);
