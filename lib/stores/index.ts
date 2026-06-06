// Dependencies
import { z } from 'zod';
import { Types } from 'mongoose';

// Database
import Store from '@/database/models/Store';
import { connectDB } from '@/database/mongoose';

// Constants
import { EPlatform } from '@/lib/globalConstants';
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

// ---------------------------------------------------------------------------
// Zod Schemas — Platform-specific credential validation
// ---------------------------------------------------------------------------

const ShopifyConfigSchema = z.object({ storeUrl: z.url(), accessToken: z.string().min(10) });
const AmazonConfigSchema = z.object({ apiKey: z.string().min(5), endpoint: z.enum(['US', 'EU']) });
const WooCommerceConfigSchema = z.object({ storeUrl: z.url(), consumerKey: z.string().startsWith('ck_'), consumerSecret: z.string().startsWith('cs_') });

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

    // 3. Check Credentials
    if (!configValidation.success) return { success: false, message: `Invalid credentials for ${platform}.` };

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

    if (isDuplicateError(error)) {
      const pattern = getKeyPattern(error);
      if (pattern?.config?.storeUrl) message = 'This store is already connected.';
      if (pattern?.name) message = 'You already have a store with this nickname.';
    }

    trackEvent(userId, STORE_ADD_FAILED, { error: message });
    return { success: false, message };
  }
}

// ---------------------------------------------------------------------------
// getStoresByUserId
// ---------------------------------------------------------------------------

export async function getStoresByUserId({ userId }: { userId: string }) {
  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Fetch stores (exclude sensitive config)
    const stores = await Store.find({ userId: new Types.ObjectId(userId) })
      .select('-config')
      .sort({ createdAt: -1 })
      .lean();

    // 3. Serialize Mongoose ObjectIds to plain strings
    const sanitizedStores = JSON.parse(JSON.stringify(stores));
    return { success: true, message: 'Stores fetched successfully!', stores: sanitizedStores };
  } catch (error) {
    console.error('🚩 GET_STORES_ERROR:', error);
    return { success: false, message: 'Failed to fetch stores.' };
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

    // 4. Validate the incoming config fields against the platform's schema
    if (config) {
      let configValidation;

      if (store.platform === EPlatform.SHOPIFY) configValidation = ShopifyConfigSchema.partial().safeParse(config);
      else if (store.platform === EPlatform.AMAZON) configValidation = AmazonConfigSchema.partial().safeParse(config);
      else if (store.platform === EPlatform.WOOCOMMERCE) configValidation = WooCommerceConfigSchema.partial().safeParse(config);
      else return { success: false, message: 'Invalid platform selected.' };

      if (!configValidation.success) return { success: false, message: `Incorrect credential fields for ${store.platform}.` };
    }

    // 5. Build the $set update object
    const updateFields: Record<string, unknown> = {};
    if (name) updateFields.name = name;
    if (isSyncEnabled !== undefined) updateFields.isSyncEnabled = isSyncEnabled;

    // Use dot-notation for nested config keys so we merge rather than overwrite
    if (config) {
      Object.keys(config).forEach((key) => {
        const value = config[key] as string | null | undefined;
        // Skip empty/null values — "leave blank to keep current"
        if (![undefined, '', null].includes(value)) updateFields[`config.${key}`] = value;
      });
    }

    // 6. Apply update
    const res = await Store.updateOne({ _id: new Types.ObjectId(storeId), userId: new Types.ObjectId(userId) }, { $set: updateFields });
    if (!res.modifiedCount) return { success: false, message: 'Store not found, access denied or no changes made.' };

    // 7. Return success
    return { success: true, message: 'Store edited successfully!' };
  } catch (error) {
    console.error('🚩 EDIT_STORE_ERROR:', error);
    return { success: false, message: 'Failed to edit store.' };
  }
}
