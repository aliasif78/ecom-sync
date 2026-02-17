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
import { DEF_LOC_ID, PLATFORMS } from '@/lib/globalConstants';

// Utils
import { getCurrentUser, setSyncMutex } from '@/lib/users';

// Inngest
import { inngest } from '@/lib/inngest/client';

export const syncProductStock = async (productId: string, newStock: number, reason: string, platform: (typeof PLATFORMS)[number], description?: string) => {
  const isProduction = process.env.NODE_ENV === 'production'; // 'development' locally, 'production' on Vercel
  let session = null;

  // 1. Centralized Auth
  const { success, user, message } = await getCurrentUser();
  const userId = user?._id.toString() || '';
  let isSyncLocked = false;

  if (!success || !user) {
    console.error(`🚩 SYNC_PRODUCT_STOCK_ERROR: User not found`);
    return { success: false, message: message || 'Unauthorized' };
  }

  try {
    // 2. Check the mutex
    if (user.isSyncing) {
      console.error(`🚩 SYNC_PRODUCT_STOCK_ERROR: User is already syncing`);
      return { success: false, error: 'A sync is already in progress. Please wait.' };
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
      return { success: false, error: 'Product not found' };
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

    // 13. Refresh UI (Critical) - This tells Next.js: "The data at /products is stale. Fetch it again."
    revalidatePath('/products');

    // 14. Lock the mutex
    await setSyncMutex(userId, true);
    isSyncLocked = true;

    // 15. Fire the inngest sync function to update all actual real-world stores
    await inngest.send({ name: 'inventory/stock.updated', data: { sku: product.sku, quantity: newStock, userId } });

    // 16. Return success
    return { success: true, data: JSON.parse(JSON.stringify(product)) }; // Next.js serialization safety
  } catch (error) {
    if (isSyncLocked) await setSyncMutex(userId, false); // Release on error
    console.error('🚩 SYNC_PRODUCT_STOCK_ERROR:', error);
    return { success: false, error: 'Failed to sync product stock' };
  } finally {
    // 16. End Session
    if (session) session.endSession();
  }
};

export const forceSyncAllProducts = async () => {
  // 1. Get the current user
  const { success, user, message } = await getCurrentUser();
  const userId = user?._id.toString() || '';
  let isSyncLocked = false;

  if (!success || !user) {
    console.error(`🚩 FORCE_SYNC_ALL_PRODUCTS_ERROR: User not found`);
    return { success: false, message: message || 'Unauthorized' };
  }

  try {
    // 2. Check Mutex
    if (user.isSyncing) {
      console.error(`🚩 FORCE_SYNC_ALL_PRODUCTS_ERROR: User is already syncing`);
      return { success: false, error: 'A sync is already in progress. Please wait.' };
    }

    // 4. Connect to the database
    await connectDB();

    // 5. Check if products & stores exist
    const prodAndStoreExists = await Promise.all([Product.findOne({ userId }), Store.findOne({ userId, isSyncEnabled: true })]);

    if (!prodAndStoreExists[0]) return { success: false, error: 'No products found' };
    if (!prodAndStoreExists[1]) return { success: false, error: 'No stores found' };

    // 6. Lock the mutex
    await setSyncMutex(userId, true);
    isSyncLocked = true;

    // 7. Update the UI
    revalidatePath('/products');

    // 8. Tell inngest to sync all products across all stores for the user
    await inngest.send({ name: 'inventory/force.sync.all', data: { userId } });

    // 9. Return success
    return { success: true, message: 'Synced all products across all stores' };
  } catch (error) {
    if (isSyncLocked) await setSyncMutex(userId, false); // Release on error
    console.error('🚩 FORCE_SYNC_ALL_PRODUCTS_ERROR:', error);
    return { success: false, error: 'Failed to force sync all products' };
  }
};

export const getProductHistory = async (productId: string) => {
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
    let history = await InventoryLedger.find({ productId, userId: user._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'name') // 👈 Join User table, get only names
      .lean(); // 👈 Convert to plain JS objects immediately

    if (!history || !history.length) return { success: false, error: 'Product history not found' };

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
    return { success: true, data: history };
  } catch (error) {
    console.error('🚩 GET_PRODUCT_HISTORY_ERROR:', error);
    return { success: false, error: 'Failed to get product history' };
  }
};
