// Database
import Product, { IInventoryLevel } from '@/database/models/Product';
import { connectDB } from '@/database/mongoose';
import { Types } from 'mongoose';

// Constants
import { DEF_LOC_ID } from '../globalConstants';
import { PRODUCT_CREATED, PRODUCT_CREATION_FAILED, PRODUCT_ARCHIVED, PRODUCT_ARCHIVE_FAILED, PRODUCT_UPDATED, PRODUCT_UPDATE_FAILED } from '@/lib/posthog/constants';

// Utils & Helpers
import { isDuplicateError } from '../utils';
import { trackEvent } from '../posthog/helpers';

// GET Products
// This exists here, only because the component using it is a server component
// If it were a client component, we would use server actions
export async function getProducts(userId: string) {
  try {
    // 1. Connect to the DB
    await connectDB();

    // 2. Fetch products
    // lean() is 5-10x faster + gives the raw JSON data + returns POJO instead of Mongoose Docs
    // Sort by newest first (standard UX)
    const products = await Product.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    // 3. Return products
    // Manually serialize ObjectId and Dates - this prevents the "Server to Client" serialization error
    return products.map((product) => ({
      ...product,
      _id: product._id.toString(), // Fix ID
      userId: product.userId.toString(), // Fix User ID
      // If you have dates, fix them too:
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
      // Fix nested ObjectIds in inventory
      inventoryByLocation: product.inventoryByLocation?.map((inv: IInventoryLevel) => ({
        ...inv,
        _id: inv._id?.toString(), // Subdocuments have IDs too!
      })),
    }));
  } catch (error) {
    console.error('🚩 GET_PRODUCTS_ERROR:', error);
    return [];
  }
}

export async function verifyProductOwnership(_id: string, userId: string) {
  try {
    // 1. Connect to the DB
    await connectDB();

    // 2. Fetch product
    // ⚡️ SUPER FAST QUERY
    // This only checks the index. It does not load the document.
    const exists = await Product.exists({ _id, userId: new Types.ObjectId(userId) });

    // 3. Return true/false
    // .exists() returns the { _id } object if found, or null if not.
    return !!exists;
  } catch (error) {
    console.error('🚩 VERIFY_PRODUCT_OWNERSHIP_ERROR:', error);
    return false;
  }
}

export async function addProductByUserId({ userId, name, price, image, sku, stock }: { userId: string; name: string; price: number; image: string; sku: string; stock: number }) {
  try {
    // 1. Safety Check
    if (!userId || !name || !price || !image || !sku || stock === undefined) {
      console.error('🚩 ADD_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    // 2. Connect to the DB
    await connectDB();

    // 3. Inventory Logic (The Ghost Buster 👻🚫)
    // If stock > 0, we MUST assign it to a physical location (Warehouse)
    const inventoryByLocation = stock > 0 ? [{ locationId: DEF_LOC_ID, quantity: stock }] : [];

    // 4. Create product
    const newProduct = await Product.create({ userId: new Types.ObjectId(userId), name, price, image, sku, inventoryByLocation });

    // 5. 🚀 THE POSTHOG TRACKING
    trackEvent(userId, PRODUCT_CREATED, { sku: newProduct.sku, price: newProduct.price, has_image: !!newProduct.image, source: 'web_form' });

    // 6. Return product
    return { success: true, message: 'Product created successfully!' };
  } catch (error: unknown) {
    console.error('🚩 ADD_PRODUCT_ERROR:', error);
    let message = 'Failed to add product';

    // 1. Check for Duplicate Key Error (Mongoose Error Code 11000)
    if (isDuplicateError(error)) message = 'This SKU already exists. Please use a unique SKU.';

    // 2. 🐒 CHAOS MONKEY PREP: Track the failure too!
    trackEvent(userId, PRODUCT_CREATION_FAILED, { error: message });

    // 3. Generic Error
    return { success: false, message };
  }
}

export async function updateProductById({ userId, _id, name, price, image }: { userId: string; _id: string; name?: string; price?: number; image?: string }) {
  try {
    // 1. Safety Checks
    if (!userId || !_id || (!name && price === undefined && !image)) {
      console.error('🚩 UPDATE_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    if (price !== undefined && price < 0) {
      console.error('🚩 UPDATE_PRODUCT_ERROR: Price cannot be negative');
      return { success: false, message: 'Price cannot be negative' };
    }

    // 2. Connect to the DB
    await connectDB();

    // 3. Build the update data
    const updateData: { name?: string; price?: number; image?: string } = {};
    if (name) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (image) updateData.image = image;

    // 4. Update product
    const updatedProduct = await Product.findOneAndUpdate({ _id, userId: new Types.ObjectId(userId) }, updateData, { new: true, runValidators: true });
    if (!updatedProduct) return { success: false, message: 'Product not found' };

    // 5. PostHog tracking
    trackEvent(userId, PRODUCT_UPDATED, { productId: _id, updatedFields: Object.keys(updateData) });

    // 6. Return product
    return { success: true, message: 'Product updated successfully!' };
  } catch (error) {
    console.error('🚩 UPDATE_PRODUCT_ERROR:', error);
    const message = 'Failed to update product';

    // 1. PostHog error tracking
    trackEvent(userId, PRODUCT_UPDATE_FAILED, { error: message });

    // 2. Error response
    return { success: false, message };
  }
}

export async function deleteProductById({ _id, userId }: { _id: string; userId: string }) {
  try {
    // 1. Safety Checks
    if (!userId || !_id) {
      console.error('🚩 DELETE_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    // 2. Connect to the DB
    await connectDB();

    // 3. Find the product first (Our regex hook ensures this won't find already-archived items)
    const product = await Product.findOne({ _id, userId: new Types.ObjectId(userId) });
    if (!product) return { success: false, message: 'Product not found or already deleted' };

    // 4. Trigger the Soft Delete instance method
    await product.softDelete();

    // 5. Record deletion in PostHog
    // Use .getTime() to ensure both sides are pure numbers (milliseconds)
    const days_active = Math.floor((new Date().getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    trackEvent(userId, PRODUCT_ARCHIVED, { productId: _id, days_active });

    // 6. Success Response
    return { success: true, message: 'Product deleted successfully!' };
  } catch (error) {
    console.error('🚩 DELETE_PRODUCT_ERROR:', error);
    const message = 'Failed to delete product';

    // 🐒 CHAOS MONKEY PREP: Track the failure too!
    trackEvent(userId, PRODUCT_ARCHIVE_FAILED, { error: message });

    return { success: false, message };
  }
}
