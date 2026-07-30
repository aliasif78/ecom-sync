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

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Safely converts a value that may be a Mongoose `Types.ObjectId`, a string,
 * or `undefined` into a plain string (or `undefined`).
 *
 * `.lean()` preserves ObjectId instances on nested sub-documents, so every
 * optional FK field in `mappings.*` must pass through this before the data
 * crosses the server → client boundary.
 */
const toStringOrUndefined = (value: Types.ObjectId | string | undefined): string | undefined => (value !== undefined ? value.toString() : undefined);

/**
 * Safely converts a `Date`, ISO string, or `undefined` into an ISO string
 * (or `undefined`).  Used for all optional timestamp fields in `mappings.*`.
 */
const toISOOrUndefined = (value: Date | string | undefined): string | undefined => (value !== undefined ? new Date(value).toISOString() : undefined);

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Fetches all non-archived products belonging to `userId`, serializes every
 * ObjectId and Date field to string/ISO-string, and returns a shape that
 * matches `ProductRow` exactly.
 *
 * Why manual serialization?
 *   Next.js forbids passing non-serializable values (ObjectId, Date) from
 *   Server Components to Client Components as props.  `.lean()` returns POJOs
 *   but preserves `Types.ObjectId` instances on nested sub-documents, so we
 *   must walk the entire mapping tree explicitly.
 */
export async function getProducts(userId: string) {
  try {
    await connectDB();

    const products = await Product.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      message: 'Products loaded successfully!',
      products: products.map((product) => ({
        ...product,

        // ── Top-level ObjectIds & Dates ──────────────────────────────────
        _id: product._id.toString(),
        userId: product.userId.toString(),
        createdAt: product.createdAt?.toISOString(),
        updatedAt: product.updatedAt?.toISOString(),

        // ── Analytics timestamps ─────────────────────────────────────────
        // lastRiskAnalysis REMOVED (Feature 2 cleanup) — field no longer exists on Product.
        archivedAt: toISOOrUndefined(product.archivedAt),

        // ── Inventory sub-documents ──────────────────────────────────────
        inventoryByLocation: product.inventoryByLocation?.map((inv: IInventoryLevel) => ({
          ...inv,
          _id: inv._id?.toString(),
        })),

        // ── Platform mappings — ObjectIds + Dates in every slot ──────────
        //
        // `.lean()` preserves `Types.ObjectId` on nested sub-documents.
        // `storeId` is a FK to Store, so it must be stringified.
        // `lastSyncedAt` is a Date that must become an ISO string.
        // Every field is optional (undefined until the first sync fires).
        mappings: {
          shopify: {
            ...product.mappings?.shopify,
            storeId: toStringOrUndefined(product.mappings?.shopify?.storeId),
            lastSyncedAt: toISOOrUndefined(product.mappings?.shopify?.lastSyncedAt),
          },
          amazon: {
            ...product.mappings?.amazon,
            storeId: toStringOrUndefined(product.mappings?.amazon?.storeId),
            lastSyncedAt: toISOOrUndefined(product.mappings?.amazon?.lastSyncedAt),
          },
          woocommerce: {
            ...product.mappings?.woocommerce,
            storeId: toStringOrUndefined(product.mappings?.woocommerce?.storeId),
            lastSyncedAt: toISOOrUndefined(product.mappings?.woocommerce?.lastSyncedAt),
          },
        },
      })),
    };
  } catch (error) {
    console.error('🚩 GET_PRODUCTS_ERROR:', error);
    return {
      success: false,
      message: 'An unexpected error occured while fetching your products.',
      products: [],
    };
  }
}

export async function verifyProductOwnership(_id: string, userId: string) {
  try {
    await connectDB();

    // ⚡️ Index-only query — does not load the full document.
    const exists = await Product.exists({ _id, userId: new Types.ObjectId(userId) });

    // `.exists()` returns `{ _id }` when found, `null` when not.
    return !!exists;
  } catch (error) {
    console.error('🚩 VERIFY_PRODUCT_OWNERSHIP_ERROR:', error);
    return false;
  }
}

export async function addProductByUserId({ userId, name, price, image, sku, stock }: { userId: string; name: string; price: number; image: string; sku: string; stock: number }) {
  try {
    if (!userId || !name || !price || !image || !sku || stock === undefined) {
      console.error('🚩 ADD_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    await connectDB();

    // If stock > 0 we MUST assign it to a physical location (Warehouse).
    const inventoryByLocation = stock > 0 ? [{ locationId: DEF_LOC_ID, quantity: stock }] : [];

    const newProduct = await Product.create({
      userId: new Types.ObjectId(userId),
      name,
      price,
      image,
      sku,
      inventoryByLocation,
    });

    trackEvent(userId, PRODUCT_CREATED, {
      sku: newProduct.sku,
      price: newProduct.price,
      has_image: !!newProduct.image,
      source: 'web_form',
    });

    return { success: true, message: 'Product created successfully!' };
  } catch (error: unknown) {
    console.error('🚩 ADD_PRODUCT_ERROR:', error);
    let message = 'Failed to add product';

    if (isDuplicateError(error)) message = 'This SKU already exists. Please use a unique SKU.';

    trackEvent(userId, PRODUCT_CREATION_FAILED, { error: message });

    return { success: false, message };
  }
}

export async function updateProductById({ userId, _id, name, price, image }: { userId: string; _id: string; name?: string; price?: number; image?: string }) {
  try {
    if (!userId || !_id || (!name && price === undefined && !image)) {
      console.error('🚩 UPDATE_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    if (price !== undefined && price < 0) {
      console.error('🚩 UPDATE_PRODUCT_ERROR: Price cannot be negative');
      return { success: false, message: 'Price cannot be negative' };
    }

    await connectDB();

    const updateData: { name?: string; price?: number; image?: string } = {};
    if (name) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (image) updateData.image = image;

    const updatedProduct = await Product.findOneAndUpdate({ _id, userId: new Types.ObjectId(userId) }, updateData, { new: true, runValidators: true });
    if (!updatedProduct) return { success: false, message: 'Product not found' };

    trackEvent(userId, PRODUCT_UPDATED, { productId: _id, updatedFields: Object.keys(updateData) });

    return { success: true, message: 'Product updated successfully!' };
  } catch (error) {
    console.error('🚩 UPDATE_PRODUCT_ERROR:', error);
    const message = 'Failed to update product';
    trackEvent(userId, PRODUCT_UPDATE_FAILED, { error: message });
    return { success: false, message };
  }
}

export async function deleteProductById({ _id, userId }: { _id: string; userId: string }) {
  try {
    if (!userId || !_id) {
      console.error('🚩 DELETE_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    await connectDB();

    // The `^find` pre-hook on the schema automatically excludes archived products,
    // so this query will not match an already-soft-deleted document.
    const product = await Product.findOne({ _id, userId: new Types.ObjectId(userId) });
    if (!product) return { success: false, message: 'Product not found or already deleted' };

    await product.softDelete();

    const days_active = Math.floor((new Date().getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    trackEvent(userId, PRODUCT_ARCHIVED, { productId: _id, days_active });

    return { success: true, message: 'Product deleted successfully!' };
  } catch (error) {
    console.error('🚩 DELETE_PRODUCT_ERROR:', error);
    const message = 'Failed to delete product';
    trackEvent(userId, PRODUCT_ARCHIVE_FAILED, { error: message });
    return { success: false, message };
  }
}
