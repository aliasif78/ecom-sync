// Inngest
import { inngest } from './client';

// Database
import { connectDB } from '@/database/mongoose';
import Store from '@/database/models/Store';

// Adapters
import { getAdapter } from '@/lib/adapters';

// Types
import { StoreRow } from '@/types';
import { EPlatform } from '../globalConstants';

// 1. Define the Function
export const syncStockToStores = inngest.createFunction(
  { id: 'sync-stock-to-stores' },
  { event: 'inventory/stock.updated' }, // 👂 The Trigger

  async ({ event, step }) => {
    // 1. Extract data
    const { sku, quantity } = event.data;

    // 2. Validation
    if (!sku || quantity === undefined) return { error: 'Missing SKU or Quantity' };

    // 3. Fetch Active Stores (The "Target List")
    const stores = await step.run('fetch-active-stores', async () => {
      // 1. Establish DB connection
      await connectDB();

      // 2. Get sync enabled stores - We use .lean() for performance and JSON serialization
      const results = await Store.find({ isSyncEnabled: true }).lean();

      // 3. Convert to JSON
      return JSON.parse(JSON.stringify(results));
    });

    // 4. Check if there are any stores to sync
    if (stores.length === 0) return { message: 'No active stores to sync.', sku };

    // 5. Fan-Out - Sync all stores ⚔️
    // We launch a separate step for EACH store
    // Run all syncs in parallel
    const syncResults = await Promise.all(
      stores.map((store: StoreRow) =>
        step.run(`sync-${store.platform}-${store._id}`, async () => {
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
        })
      )
    );

    // 6. Return final results
    return { message: 'Sync Complete', sku, results: syncResults };
  }
);
