// These server actions are always called by client components
'use server'; // Explicity marked as these functions will be used by client components

// Next JS
import { revalidatePath } from 'next/cache';

// Database
import { connectDB } from '@/database/mongoose';
import Product, { IInventoryLevel } from '@/database/models/Product';
import Store from '@/database/models/Store';
import InventoryLedger from '@/database/models/InventoryLedger';
import mongoose from 'mongoose';

// Constants
import { DEF_LOC_ID, MUTEX_ALL, PLATFORMS } from '@/lib/globalConstants';
import { FORCE_SYNC_ALL_PRODUCTS, FORCE_SYNC_ALL_PRODUCTS_FAILED, SYNC_PRODUCT, SYNC_PRODUCT_FAILED } from '@/lib/posthog/constants';

// Utils & Helpers
import { getCurrentUser, addSyncMutex, removeSyncMutex } from '@/lib/users';
import { trackEvent } from '@/lib/posthog/helpers';

// Inngest
import { inngest } from '@/lib/inngest/client';

// Auth
import { authGuard } from '@/lib/safe-action';

export const syncProductStock = async (productId: string, newStock: number, reason: string, platform: (typeof PLATFORMS)[number], sku: string, description?: string) => {
  return authGuard<{ success: boolean; message: string }>('SYNC_PRODUCT_STOCK', '/products', async (userId) => {
    const isProduction = process.env.NODE_ENV === 'production'; // 'development' locally, 'production' on Vercel
    let session = null;
    let latestSku = sku;

    // 1. Centralized Auth
    const { success, user, message } = await getCurrentUser();
    let isSyncLocked = false;

    if (!success || !user) {
      console.error(`🚩 SYNC_PRODUCT_STOCK_ERROR: User not found`);
      return { success: false, message: message || 'Unauthorized' };
    }

    try {
      // 2. Check the mutex
      if (user.isSyncing.includes(latestSku)) {
        console.error(`🚩 SYNC_PRODUCT_STOCK_ERROR: User is already syncing`);
        return { success: false, message: 'A sync is already in progress. Please wait.' };
      }

      // 3. Connect to the database
      await connectDB();

      // 4. Start Transaction 🛡️ - This ensures Product and Ledger update together, or fail together.
      if (isProduction) {
        session = await mongoose.startSession();
        session.startTransaction();
      }

      // 5. Find the product
      const product = await Product.findOne({ _id: productId, userId }).session(session);

      if (!product) {
        if (session) await session.abortTransaction();
        return { success: false, message: 'Product not found' };
      }

      // 6. Update the stock
      const oldStock = product.stock;

      if (oldStock === newStock) {
        if (session) await session.abortTransaction();
        return { success: true, message: 'Stock is already the same' };
      }

      // 7. Update Product Logic (Handle the Array!) 📦
      // We update the specific location.
      // If the location doesn't exist, we should push it (simplified here to update existing).
      latestSku = product.sku;
      const locationIndex = product.inventoryByLocation.findIndex((inv: IInventoryLevel) => inv.locationId.toString() === DEF_LOC_ID);

      // Update existing location
      if (locationIndex > -1) product.inventoryByLocation[locationIndex].quantity = newStock;
      // Create new location entry if missing
      else product.inventoryByLocation.push({ locationId: DEF_LOC_ID, quantity: newStock });

      // 8. Update the root stock number to match
      product.stock = newStock;

      // 9. Save the product
      await product.save({ session });

      // 11. Log the ledger entry
      await InventoryLedger.create([{ productId, userId, oldStock, newStock, reason, locationId: DEF_LOC_ID, platform, description }], { session });

      // 12. Commit Transaction
      if (session) await session.commitTransaction();

      // 13. Lock the mutex
      await addSyncMutex(userId, latestSku);
      isSyncLocked = true;

      // 14. Refresh UI (Critical) - This tells Next.js: "The data at /products is stale. Fetch it again."
      revalidatePath('/products');

      // 15. Fire the inngest sync function to update all actual real-world stores
      await inngest.send({ name: 'inventory/stock.updated', data: { sku: latestSku, quantity: newStock, userId } }); // Don't blindly trust the FE SKU

      // 16. Track the event in PostHog
      trackEvent(userId, SYNC_PRODUCT, { sku: latestSku, quantity: newStock, productId });

      // 17. Return success
      return { success: true, message: 'Product stock updated successfully.' }; // Next.js serialization safety
    } catch (error) {
      console.error('🚩 SYNC_PRODUCT_STOCK_ERROR:', error);
      const message = 'Failed to sync product stock';

      // 1. Release mutex
      if (isSyncLocked) await removeSyncMutex(userId, latestSku);

      // 2. Track the event in PostHog
      trackEvent(userId, SYNC_PRODUCT_FAILED, { productId, error: message });

      // 3. Error response
      return { success: false, message };
    } finally {
      // 16. End Session
      if (session) session.endSession();
    }
  });
};

export const forceSyncAllProducts = async () => {
  return authGuard<{ success: boolean; message: string }>('FORCE_SYNC_ALL_PRODUCTS', '/products', async (userId) => {
    // 1. Get the current user
    const { success, user, message } = await getCurrentUser();

    if (!success || !user) {
      console.error(`🚩 FORCE_SYNC_ALL_PRODUCTS_ERROR: User not found`);
      return { success: false, message: message || 'Unauthorized' };
    }

    try {
      // 2. Check Mutex
      if (user.isSyncing.length) {
        console.error(`🚩 FORCE_SYNC_ALL_PRODUCTS_ERROR: User is already syncing`);
        return { success: false, message: 'A sync is already in progress. Please wait.' };
      }

      // 4. Connect to the database
      await connectDB();

      // 5. Check if products & stores exist
      const prodAndStoreExists = await Promise.all([Product.findOne({ userId }), Store.findOne({ userId, isSyncEnabled: true })]);

      if (!prodAndStoreExists[0]) return { success: false, message: 'No products found' };
      if (!prodAndStoreExists[1]) return { success: false, message: 'No stores found' };

      // 6. Lock the mutex
      await addSyncMutex(userId, MUTEX_ALL);

      // 7. Update the UI
      revalidatePath('/products');

      // 8. Tell inngest to sync all products across all stores for the user
      await inngest.send({ name: 'inventory/force.sync.all', data: { userId } });

      // 9. Track the event in PostHog
      trackEvent(userId, FORCE_SYNC_ALL_PRODUCTS, {});

      // 10. Return success
      return { success: true, message: 'Synced all products across all stores.' };
    } catch (error) {
      console.error('🚩 FORCE_SYNC_ALL_PRODUCTS_ERROR:', error);
      const message = 'Failed to force sync all products';

      // Post Hog Error Tracking
      trackEvent(userId, FORCE_SYNC_ALL_PRODUCTS_FAILED, { error: message });

      // Error response
      return { success: false, message };
    }
  });
};

export const getProductHistory = async (productId: string) => {
  return authGuard<{ success: boolean; message: string; data?: unknown }>('GET_PRODUCT_HISTORY', null, async (userId) => {
    try {
      // 1. Get the current user
      const { success, user, message } = await getCurrentUser();

      if (!success || !user) {
        console.error(`🚩 GET_PRODUCT_HISTORY_ERROR: User not found`);
        return { success: false, message: message || 'Unauthorized' };
      }

      // 2. Connect to the database
      await connectDB();

      // 3. Get the product history
      let history = await InventoryLedger.find({ productId, userId })
        .sort({ createdAt: -1 })
        .populate('userId', 'name') // 👈 Join User table, get only names
        .lean(); // 👈 Convert to plain JS objects immediately

      if (!history || !history.length) return { success: false, message: 'Product history not found' };

      // 4. Map to plain objects and sanitize IDs
      history = history.map((entry) => ({
        ...entry,
        _id: entry._id.toString(),
        userId: entry.userId.toString(),
        productId: entry.productId.toString(),
        locationId: entry.locationId.toString(),
        userName: entry.userId.name,
        createdAt: entry.createdAt.toISOString(),
      }));

      // 5. Return success
      return { success: true, message: 'Product history retrieved successfully', data: history };
    } catch (error) {
      console.error('🚩 GET_PRODUCT_HISTORY_ERROR:', error);
      return { success: false, message: 'Failed to get product history' };
    }
  });
};
