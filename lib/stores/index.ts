'use server';

// Dependencies
import { z } from 'zod';
import { Types } from 'mongoose';

// Database
import Store from '@/database/models/Store';
import { connectDB } from '@/database/mongoose';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// Utils
import { getKeyPattern, isDuplicateError } from '@/lib/utils';

// --- Types ---
export interface AddStoreParams {
  userId: string;
  name: string;
  platform: EPlatform;
  isSyncEnabled: boolean;
  config: Record<string, unknown>;
}

// --- Zod Schemas (The Bouncer) ---
const ShopifyConfigSchema = z.object({ shopUrl: z.url(), accessToken: z.string().min(10) });
const AmazonConfigSchema = z.object({ apiKey: z.string().min(5), endpoint: z.enum(['US', 'EU']) });
const WooCommerceConfigSchema = z.object({ shopUrl: z.url(), consumerKey: z.string().startsWith('ck_'), consumerSecret: z.string().startsWith('cs_') });

export async function addStore(params: AddStoreParams) {
  try {
    // 1. Basic Validation
    const { userId, name, platform, config, isSyncEnabled } = params;
    if (!userId || !name || !platform) return { success: false, message: 'Missing required fields: userId, name, or platform.' };

    // 2. Platform-Specific Validation & Identity Extraction
    let configValidation;
    let uniqueIdentity = '';

    // Shopify
    if (platform === EPlatform.SHOPIFY) {
      configValidation = ShopifyConfigSchema.safeParse(config);
      if (configValidation.success) uniqueIdentity = configValidation.data.shopUrl;
    }

    // Amazon
    else if (platform === EPlatform.AMAZON) {
      configValidation = AmazonConfigSchema.safeParse(config);
      if (configValidation.success) uniqueIdentity = configValidation.data.apiKey;
    }

    // WooCommerce
    else if (platform === EPlatform.WOOCOMMERCE) {
      configValidation = WooCommerceConfigSchema.safeParse(config);
      if (configValidation.success) uniqueIdentity = configValidation.data.shopUrl;
    }

    // Invalid Platform
    else return { success: false, message: 'Invalid platform selected.' };

    // 3. Check Credentials
    if (!configValidation.success) return { success: false, message: `Invalid credentials for ${platform}.` };

    // 4. Connect to DB
    await connectDB();

    // 5. Create Store
    const newStore = await Store.create({ userId: new Types.ObjectId(userId), name, platform, storeUrl: uniqueIdentity, config: configValidation.data, isSyncEnabled, isConnected: false });

    // 6. Return store
    return { success: true, message: 'Store added successfully! Verifying connection...', storeId: newStore._id.toString() };
  } catch (error) {
    console.error('🚩 ADD_STORE_ERROR:', error);

    // --- The Duplicate Key Handler ---
    // Logic: MongoDB throws code 11000 when a unique index is violated.
    // We have a compound index on { userId: 1, name: 1 }
    if (isDuplicateError(error)) {
      const pattern = getKeyPattern(error);
      if (pattern?.storeUrl) return { success: false, message: 'This store is already connected.' };
      if (pattern?.name) return { success: false, message: 'You already have a store with this nickname.' };
    }

    return { success: false, message: 'Failed to add store.' };
  }
}
