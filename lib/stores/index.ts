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

// --- Types ---
export interface AddStoreParams {
  userId: string;
  name: string;
  platform: EPlatform;
  isSyncEnabled: boolean;
  config: Record<string, unknown>;
}

// --- Zod Schemas (The Bouncer) ---
const ShopifyConfigSchema = z.object({ storeUrl: z.url(), accessToken: z.string().min(10) });
const AmazonConfigSchema = z.object({ apiKey: z.string().min(5), endpoint: z.enum(['US', 'EU']) });
const WooCommerceConfigSchema = z.object({ storeUrl: z.url(), consumerKey: z.string().startsWith('ck_'), consumerSecret: z.string().startsWith('cs_') });

export async function addStore(params: AddStoreParams) {
  const { userId, name, platform, config, isSyncEnabled } = params;

  try {
    // 1. Basic Validation
    if (!userId || !name || !platform) return { success: false, message: 'Missing required fields: userId, name, or platform.' };

    // 2. Platform-Specific Validation & Identity Extraction
    let configValidation;

    // Shopify
    if (platform === EPlatform.SHOPIFY) configValidation = ShopifyConfigSchema.safeParse(config);
    // Amazon
    else if (platform === EPlatform.AMAZON) configValidation = AmazonConfigSchema.safeParse(config);
    // WooCommerce
    else if (platform === EPlatform.WOOCOMMERCE) configValidation = WooCommerceConfigSchema.safeParse(config);
    // Invalid Platform
    else return { success: false, message: 'Invalid platform selected.' };

    // 3. Check Credentials
    if (!configValidation.success) return { success: false, message: `Invalid credentials for ${platform}.` };

    // 4. Connect to DB
    await connectDB();

    // 5. Create Store
    const newStore = await Store.create({ userId: new Types.ObjectId(userId), name, platform, config: configValidation.data, isSyncEnabled, isConnected: false });

    // 6. Track the event in PostHog
    trackEvent(userId, STORE_ADDED, { storeId: newStore._id.toString(), platform });

    // 7. Return store
    return { success: true, message: 'Store added successfully! Verifying connection...', storeId: newStore._id.toString() };
  } catch (error) {
    console.error('🚩 ADD_STORE_ERROR:', error);
    let message = 'Failed to add store.';

    // --- 1. The Duplicate Key Handler ---
    // Logic: MongoDB throws code 11000 when a unique index is violated.
    // We have a compound index on { userId: 1, name: 1 }
    if (isDuplicateError(error)) {
      const pattern = getKeyPattern(error);
      if (pattern?.config?.storeUrl) message = 'This store is already connected.';
      if (pattern?.name) message = 'You already have a store with this nickname.';
    }

    // --- 2. PostHog Error Tracking ---
    trackEvent(userId, STORE_ADD_FAILED, { error: message });

    // --- 3. The Generic Error Handler ---
    return { success: false, message };
  }
}

export async function getStoresByUserId({ userId }: { userId: string }) {
  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Fetch stores
    const stores = await Store.find({ userId: new Types.ObjectId(userId) })
      .select('-config')
      .sort({ createdAt: -1 })
      .lean();

    // 3. Return stores
    // Next.js Serialization Fix:
    // Mongoose IDs are objects. Convert to string to avoid "Client Component" warnings.
    const sanitizedStores = JSON.parse(JSON.stringify(stores));
    return { success: true, message: 'Stores fetched successfully!', stores: sanitizedStores };
  } catch (error) {
    console.error('🚩 GET_STORES_ERROR:', error);
    return { success: false, message: 'Failed to fetch stores.' };
  }
}

export async function deleteStoreById({ storeId, userId }: { storeId: string; userId: string }) {
  try {
    // 1. Connect to DB
    await connectDB();

    // 2. Delete store
    const result = await Store.deleteOne({ _id: new Types.ObjectId(storeId), userId: new Types.ObjectId(userId) });
    if (!result.deletedCount) return { success: false, message: 'Store not found or access denied.' };

    // 3. Track the event in PostHog
    trackEvent(userId, STORE_DELETED, { storeId });

    // 4. Return success
    return { success: true, message: 'Store deleted successfully!' };
  } catch (error) {
    console.error('🚩 DELETE_STORE_ERROR:', error);
    const message = 'Failed to delete store.';

    // 1. Post Hog error tracking
    trackEvent(userId, STORE_DELETE_FAILED, { error: message });

    // 2. Error response
    return { success: false, message };
  }
}

export async function editStoreById({ storeId, userId, name, config, isSyncEnabled }: { storeId: string; userId: string; name?: string; config?: Record<string, unknown>; isSyncEnabled?: boolean }) {
  try {
    // 1. Basic Validation
    if (!storeId || !userId || (!name && !config && isSyncEnabled === undefined)) return { success: false, message: 'Missing required fields: storeId, userId, name, config, or isSyncEnabled.' };

    // 2. Connect to DB
    await connectDB();

    // 3. Get the store
    const store = await Store.findOne({ _id: new Types.ObjectId(storeId), userId: new Types.ObjectId(userId) }).select('-config');
    if (!store) return { success: false, message: 'Store not found or access denied.' };

    // 4. Validate the config fields
    if (config) {
      let configValidation;

      if (store.platform === EPlatform.SHOPIFY) configValidation = ShopifyConfigSchema.partial().safeParse(config);
      else if (store.platform === EPlatform.AMAZON) configValidation = AmazonConfigSchema.partial().safeParse(config);
      else if (store.platform === EPlatform.WOOCOMMERCE) configValidation = WooCommerceConfigSchema.partial().safeParse(config);
      else return { success: false, message: 'Invalid platform selected.' };

      if (!configValidation.success) return { success: false, message: `Incorrect credential fields for ${store.platform}.` };
    }

    // 5. Build the update object
    const updateFields: Record<string, unknown> = {};
    if (name) updateFields.name = name;
    if (isSyncEnabled !== undefined) updateFields.isSyncEnabled = isSyncEnabled;

    // 💡 Don't set 'config' directly. Set 'config.key'
    if (config) {
      Object.keys(config).forEach((key) => {
        const value = config[key] as string | null | undefined;
        // Only update if value is not empty/null
        if (![undefined, '', null].includes(value)) updateFields[`config.${key}`] = value; // 👈 "config.shopUrl" merges safely
      });
    }

    // 5. Edit store
    const res = await Store.updateOne({ _id: new Types.ObjectId(storeId), userId: new Types.ObjectId(userId) }, { $set: updateFields });
    if (!res.modifiedCount) return { success: false, message: 'Store not found, access denied or no changes made.' };

    // 6. Return success
    return { success: true, message: 'Store edited successfully!' };
  } catch (error) {
    console.error('🚩 EDIT_STORE_ERROR:', error);
    return { success: false, message: 'Failed to edit store.' };
  }
}
