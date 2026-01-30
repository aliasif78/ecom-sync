// These server actions are always called by client components
'use server'; // Explicity marked as these functions will be used by client components

// Next JS
import { revalidatePath } from 'next/cache';

// Database
import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';
import InventoryLedger from '@/database/models/InventoryLedger';

// Constants
import { DEF_LOC_ID, PLATFORMS } from '@/lib/globalConstants';

export const syncProductStock = async (productId: string, newStock: number, reason: string, platform: (typeof PLATFORMS)[number]) => {
  try {
    // 1. Connect to the database
    await connectDB();

    // 2. Find the product
    const product = await Product.findById(productId);
    if (!product) return { success: false, error: 'Product not found' };

    // 3. Update the stock
    const oldStock = product.stock;
    if (oldStock === newStock) return { success: true, message: 'Stock is already the same' };
    product.stock = newStock;

    // 4. Log the ledger entry
    await InventoryLedger.create({ product: productId, oldStock, newStock, reason, locationId: DEF_LOC_ID, platform });

    // 5. Save the product
    await product.save();

    // 6. Refresh UI (Critical)
    // This tells Next.js: "The data at /products is stale. Fetch it again."
    revalidatePath('/products');

    // 7. Return success
    return { success: true, data: JSON.parse(JSON.stringify(product)) }; // Next.js serialization safety
  } catch (error) {
    console.error('🚩 SYNC_PRODUCT_STOCK_ERROR:', error);
    return { success: false, error: 'Failed to sync product stock' };
  }
};
