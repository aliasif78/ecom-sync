// These server actions are always called by client components
'use server'; // Explicity marked as these functions will be used by client components

// Next JS
import { revalidatePath } from 'next/cache';

// Database
import { connectDB } from '@/database/mongoose';
import Product, { IInventoryLevel } from '@/database/models/Product';
import InventoryLedger from '@/database/models/InventoryLedger';
import mongoose from 'mongoose';

// Constants
import { DEF_LOC_ID, PLATFORMS } from '@/lib/globalConstants';
import { getCurrentUser } from '@/lib/users';

export const syncProductStock = async (productId: string, newStock: number, reason: string, platform: (typeof PLATFORMS)[number], description?: string) => {
  const isProduction = process.env.NODE_ENV === 'production'; // 'development' locally, 'production' on Vercel
  let session = null;

  try {
    // 1. Centralized Auth
    const { success, user, message } = await getCurrentUser();

    if (!success || !user) {
      console.error(`🚩 SYNC_PRODUCT_STOCK_ERROR: User not found`);
      return { success: false, message: message || 'Unauthorized' };
    }

    // 2. Connect to the database
    await connectDB();

    // 3. Start Transaction 🛡️
    // This ensures Product and Ledger update together, or fail together.
    if (isProduction) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    // 4. Find the product
    const product = await Product.findOne({ _id: productId, userId: user._id }).session(session);

    if (!product) {
      if (session) await session.abortTransaction();
      return { success: false, error: 'Product not found' };
    }

    // 5. Update the stock
    const oldStock = product.stock;

    if (oldStock === newStock) {
      if (session) await session.abortTransaction();
      return { success: true, message: 'Stock is already the same' };
    }

    // 6. Update Product Logic (Handle the Array!) 📦
    // We update the specific location.
    // If the location doesn't exist, we should push it (simplified here to update existing).
    const locationIndex = product.inventoryByLocation.findIndex((inv: IInventoryLevel) => inv.locationId.toString() === DEF_LOC_ID);

    // Update existing location
    if (locationIndex > -1) product.inventoryByLocation[locationIndex].quantity = newStock;
    // Create new location entry if missing
    else product.inventoryByLocation.push({ locationId: DEF_LOC_ID, quantity: newStock });

    // Update the root stock number to match
    // product.stock = newStock;

    // 7. Save the product
    await product.save({ session });

    // 8. Log the ledger entry
    await InventoryLedger.create([{ productId, userId: user._id, oldStock, newStock, reason, locationId: DEF_LOC_ID, platform, description }], { session });

    // 9. Commit Transaction
    if (session) await session.commitTransaction();

    // 10. Refresh UI (Critical)
    // This tells Next.js: "The data at /products is stale. Fetch it again."
    revalidatePath('/products');

    // 11. Return success
    return { success: true, data: JSON.parse(JSON.stringify(product)) }; // Next.js serialization safety
  } catch (error) {
    console.error('🚩 SYNC_PRODUCT_STOCK_ERROR:', error);
    return { success: false, error: 'Failed to sync product stock' };
  } finally {
    // 12. End Session
    if (session) session.endSession();
  }
};
