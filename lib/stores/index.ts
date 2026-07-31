// Dependencies
import { z } from 'zod';
import { Types } from 'mongoose';

// Database
import Store from '@/database/models/Store';
import { connectDB } from '@/database/mongoose';

// Constants
import { EPlatform, DEFAULT_STORES_PAGE_SIZE, MAX_STORES_PAGE_SIZE } from '@/lib/globalConstants';
import { STORE_ADDED, STORE_ADD_FAILED, STORE_DELETED, STORE_DELETE_FAILED } from '../posthog/constants';

// Utils & Helpers
import { getKeyPattern, isDuplicateError } from '@/lib/utils';
import { trackEvent } from '../posthog/helpers';

// Types
import { StoreStats } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddStoreParams {
  userId: string;
  name: string;
  platform: EPlatform;
  isSyncEnabled: boolean;
  config: Record<string, unknown>;
}

/** Shape of per-field credential errors returned to the client. */
export type StoreFieldErrors = Partial<Record<'name' | 'storeUrl' | 'accessToken' | 'apiKey' | 'consumerKey' | 'consumerSecret', string>>;

/**
 * Pagination metadata for the /stores list. Exported from here (not
 * types/index.ts) for the same reason as ProductsPaginationInfo in
 * lib/products/index.ts — this module owns the shape of what it returns.
 */
export interface StoresPaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Zod Schemas — Platform-specific credential validation
// ---------------------------------------------------------------------------

const ShopifyConfigSchema = z.object({ storeUrl: z.url(), accessToken: z.string().min(10) });
const AmazonConfigSchema = z.object({ apiKey: z.string().min(5), endpoint: z.enum(['US', 'EU']) });
const WooCommerceConfigSchema = z.object({
  storeUrl: z.url(),
  consumerKey: z.string().startsWith('ck_'),
  consumerSecret: z.string().startsWith('cs_'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runtime shape of the object returned by `z.treeifyError`.
 * Zod's TS declarations are looser than the actual runtime value,
 * so we define this locally and cast to it.
 */
interface ZodErrorTree {
  errors: string[];
  properties?: Record<string, { errors: string[] }>;
}

/**
 * Converts a ZodError into a flat `{ field: firstErrorMessage }` map,
 * then replaces Zod's technical messages with user-friendly copy.
 *
 * Uses `z.treeifyError` (Zod v4+) which returns:
 *   `{ errors: string[], properties: { [field]: { errors: string[] } } }`
 */
function extractFieldErrors(error: z.ZodError): StoreFieldErrors {
  const tree = z.treeifyError(error) as ZodErrorTree;
  const errs: StoreFieldErrors = {};

  // Pull the first error message from each field node in the tree
  for (const [field, node] of Object.entries(tree.properties ?? {})) {
    if (node.errors.length > 0) {
      (errs as Record<string, string>)[field] = node.errors[0];
    }
  }

  // Replace Zod's generic messages with actionable copy
  if (errs.storeUrl) errs.storeUrl = 'Store URL must be a valid URL (e.g. https://mystore.myshopify.com).';
  if (errs.accessToken) errs.accessToken = 'Access token must be at least 10 characters.';
  if (errs.apiKey) errs.apiKey = 'API key must be at least 5 characters.';
  if (errs.consumerKey) errs.consumerKey = 'Consumer key must start with "ck_".';
  if (errs.consumerSecret) errs.consumerSecret = 'Consumer secret must start with "cs_".';

  return errs;
}

// ---------------------------------------------------------------------------
// addStore
// ---------------------------------------------------------------------------

export async function addStore(params: AddStoreParams) {
  const { userId, name, platform, config, isSyncEnabled } = params;

  try {
    // 1. Basic Validation
    if (!userId || !name || !platform) return { success: false, message: 'Missing required fields: userId, name, or platform.' };

    // 2. Platform-Specific Validation & Identity Extraction
    let configValidation;

    if (platform === EPlatform.SHOPIFY) configValidation = ShopifyConfigSchema.safeParse(config);
    else if (platform === EPlatform.AMAZON) configValidation = AmazonConfigSchema.safeParse(config);
    else if (platform === EPlatform.WOOCOMMERCE) configValidation = WooCommerceConfigSchema.safeParse(config);
    else return { success: false, message: 'Invalid platform selected.' };

    // 3. Return field-level errors so the UI can highlight the exact broken fields
    if (!configValidation.success) {
      return {
        success: false,
        message: `Invalid credentials for ${platform}.`,
        fieldErrors: extractFieldErrors(configValidation.error),
      };
    }

    // 4. Connect to DB
    await connectDB();

    // 5. Create Store
    const newStore = await Store.create({
      userId: new Types.ObjectId(userId),
      name,
      platform,
      config: configValidation.data,
      isSyncEnabled,
      isConnected: false,
    });

    // 6. Track the event in PostHog
    trackEvent(userId, STORE_ADDED, { storeId: newStore._id.toString(), platform });

    // 7. Return store
    return { success: true, message: 'Store added successfully! Verifying connection...', storeId: newStore._id.toString() };
  } catch (error) {
    console.error('🚩 ADD_STORE_ERROR:', error);
    let message = 'Failed to add store.';
    let fieldErrors: StoreFieldErrors | undefined;

    if (isDuplicateError(error)) {
      const pattern = getKeyPattern(error);
      if (pattern?.config?.storeUrl) {
        message = 'A store with this URL is already connected.';
        fieldErrors = { storeUrl: 'A store with this URL is already connected.' };
      }
      if (pattern?.name) {
        message = 'You already have a store with this nickname.';
        fieldErrors = { name: 'You already have a store with this nickname.' };
      }
    }

    trackEvent(userId, STORE_ADD_FAILED, { error: message });
    return { success: false, message, ...(fieldErrors && { fieldErrors }) };
  }
}

// ---------------------------------------------------------------------------
// getStoresByUserId
// ---------------------------------------------------------------------------

/**
 * Fetches ONE PAGE of stores belonging to `userId` (config excluded),
 * plus pagination metadata for the pager.
 *
 * BE-enforced pagination, same discipline as lib/products/index.ts's
 * getProducts: `limit` is clamped to MAX_STORES_PAGE_SIZE and `page` is
 * clamped to >= 1 here, independent of whatever the caller asked for.
 *
 * No `isArchived`-style bypass concern here — Store has no soft-delete
 * field or query middleware (see database/models/Store.ts); deleteStoreById
 * hard-deletes. `countDocuments` below needs no extra filter beyond `userId`.
 */
export async function getStoresByUserId({ userId, page, limit }: { userId: string; page?: number; limit?: number }) {
  const defaultPagination: StoresPaginationInfo = { page: 1, limit: DEFAULT_STORES_PAGE_SIZE, totalCount: 0, totalPages: 1 };

  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Pagination params — clamped server-side.
    const limitClamped = Math.min(Math.max(limit ?? DEFAULT_STORES_PAGE_SIZE, 1), MAX_STORES_PAGE_SIZE);
    const pageClamped = Math.max(page ?? 1, 1);
    const skip = (pageClamped - 1) * limitClamped;

    const userObjectId = new Types.ObjectId(userId);

    // 3. Fetch this page's stores (exclude sensitive config) + total count,
    // in parallel — one network round-trip, two independent queries.
    const [stores, totalCount] = await Promise.all([Store.find({ userId: userObjectId }).select('-config').sort({ createdAt: -1 }).skip(skip).limit(limitClamped).lean(), Store.countDocuments({ userId: userObjectId })]);

    // 4. Serialize Mongoose ObjectIds to plain strings
    const sanitizedStores = JSON.parse(JSON.stringify(stores));
    const totalPages = Math.max(Math.ceil(totalCount / limitClamped), 1);

    return {
      success: true,
      message: 'Stores fetched successfully!',
      stores: sanitizedStores,
      pagination: { page: pageClamped, limit: limitClamped, totalCount, totalPages } as StoresPaginationInfo,
    };
  } catch (error) {
    console.error('🚩 GET_STORES_ERROR:', error);
    return { success: false, message: 'Failed to fetch stores.', pagination: defaultPagination };
  }
}

// ---------------------------------------------------------------------------
// getStoreStats
// ---------------------------------------------------------------------------

/**
 * Computes aggregated store statistics for a user in a single MongoDB
 * aggregation pipeline — no N+1, no multiple round-trips.
 *
 * Returns counts per platform plus the number of connected/synced stores.
 * Deliberately independent of pagination — this reflects the WHOLE
 * collection, not whichever page of stores is currently being displayed.
 *
 * @param userId - The authenticated user's MongoDB ObjectId string.
 */
export async function getStoreStats({ userId }: { userId: string }): Promise<{ success: boolean; message: string; stats?: StoreStats }> {
  try {
    // 1. Connect to DB
    await connectDB();

    /*
     * 2. Single aggregation pipeline:
     *    - $match  → scope to this user's stores only
     *    - $group  → accumulate all counters in one pass over the collection
     *
     * Each $cond acts as a conditional counter:
     *   { $cond: [<boolean expression>, 1, 0] }
     * Summing these gives us the count of documents where the condition is true.
     */
    const [result] = await Store.aggregate<StoreStats & { _id: null }>([
      {
        $match: { userId: new Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: null,
          shopify: { $sum: { $cond: [{ $eq: ['$platform', EPlatform.SHOPIFY] }, 1, 0] } },
          amazon: { $sum: { $cond: [{ $eq: ['$platform', EPlatform.AMAZON] }, 1, 0] } },
          woocommerce: { $sum: { $cond: [{ $eq: ['$platform', EPlatform.WOOCOMMERCE] }, 1, 0] } },
          connected: { $sum: { $cond: ['$isConnected', 1, 0] } },
          synced: { $sum: { $cond: ['$isSyncEnabled', 1, 0] } },
        },
      },
      {
        // Drop the internal _id field — callers don't need it
        $project: { _id: 0 },
      },
    ]);

    /*
     * 3. If the user has no stores yet, the $group stage produces no documents.
     *    Fall back to all-zeros so the UI always has a valid shape to render.
     */
    const stats: StoreStats = result ?? {
      shopify: 0,
      amazon: 0,
      woocommerce: 0,
      connected: 0,
      synced: 0,
    };

    return { success: true, message: 'Stats fetched successfully!', stats };
  } catch (error) {
    console.error('🚩 GET_STORE_STATS_ERROR:', error);
    return { success: false, message: 'Failed to fetch store stats.' };
  }
}

// ---------------------------------------------------------------------------
// deleteStoreById
// ---------------------------------------------------------------------------

export async function deleteStoreById({ storeId, userId }: { storeId: string; userId: string }) {
  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Delete store
    const result = await Store.deleteOne({
      _id: new Types.ObjectId(storeId),
      userId: new Types.ObjectId(userId),
    });
    if (!result.deletedCount) return { success: false, message: 'Store not found or access denied.' };

    // 3. Track the event in PostHog
    trackEvent(userId, STORE_DELETED, { storeId });

    // 4. Return success
    return { success: true, message: 'Store deleted successfully!' };
  } catch (error) {
    console.error('🚩 DELETE_STORE_ERROR:', error);
    const message = 'Failed to delete store.';
    trackEvent(userId, STORE_DELETE_FAILED, { error: message });
    return { success: false, message };
  }
}

// ---------------------------------------------------------------------------
// editStoreById
// ---------------------------------------------------------------------------

export async function editStoreById({ storeId, userId, name, config, isSyncEnabled }: { storeId: string; userId: string; name?: string; config?: Record<string, unknown>; isSyncEnabled?: boolean }) {
  try {
    // 1. Basic Validation
    if (!storeId || !userId || (!name && !config && isSyncEnabled === undefined)) return { success: false, message: 'Missing required fields: storeId, userId, name, config, or isSyncEnabled.' };

    // 2. Connect to DB
    await connectDB();

    // 3. Get the store (needed to know its platform for validation)
    const store = await Store.findOne({
      _id: new Types.ObjectId(storeId),
      userId: new Types.ObjectId(userId),
    }).select('-config');
    if (!store) return { success: false, message: 'Store not found or access denied.' };

    // 4. Strip blank values before validation AND before the DB update.
    //    Empty string = "leave blank to keep current" — treat as if the key
    //    was never sent. This must happen here so Zod's partial schemas never
    //    see an empty string for a url/startsWith field.
    const nonEmptyConfig = config ? Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined && v !== null && v !== '')) : undefined;

    // 5. Validate only the non-blank credential fields (partial — edit mode)
    if (nonEmptyConfig && Object.keys(nonEmptyConfig).length > 0) {
      let configValidation;

      if (store.platform === EPlatform.SHOPIFY) configValidation = ShopifyConfigSchema.partial().safeParse(nonEmptyConfig);
      else if (store.platform === EPlatform.AMAZON) configValidation = AmazonConfigSchema.partial().safeParse(nonEmptyConfig);
      else if (store.platform === EPlatform.WOOCOMMERCE) configValidation = WooCommerceConfigSchema.partial().safeParse(nonEmptyConfig);
      else return { success: false, message: 'Invalid platform selected.' };

      // Return field-level errors so the UI can highlight the exact broken fields
      if (!configValidation.success) {
        return {
          success: false,
          message: `Incorrect credential fields for ${store.platform}.`,
          fieldErrors: extractFieldErrors(configValidation.error),
        };
      }
    }

    // 6. Build the $set update object
    const updateFields: Record<string, unknown> = {};
    if (name) updateFields.name = name;
    if (isSyncEnabled !== undefined) updateFields.isSyncEnabled = isSyncEnabled;

    // Use dot-notation for nested config keys so we merge rather than overwrite
    if (nonEmptyConfig) {
      Object.keys(nonEmptyConfig).forEach((key) => {
        updateFields[`config.${key}`] = nonEmptyConfig[key];
      });
    }

    // 7. Apply update
    const res = await Store.updateOne({ _id: new Types.ObjectId(storeId), userId: new Types.ObjectId(userId) }, { $set: updateFields });
    if (!res.modifiedCount) return { success: false, message: 'Store not found, access denied or no changes made.' };

    // 7. Return success
    return { success: true, message: 'Store edited successfully!' };
  } catch (error) {
    console.error('🚩 EDIT_STORE_ERROR:', error);
    return { success: false, message: 'Failed to edit store.' };
  }
}
