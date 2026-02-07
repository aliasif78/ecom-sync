// Database
import Store from '@/database/models/Store';
import { connectDB } from '@/database/mongoose';

// Constants
import { EPlatform } from '../globalConstants';

// Types
import { Types } from 'mongoose';

// Dependencies
import { z } from 'zod';

// Utils
import { getKeyPattern, isDuplicateError } from '../utils';

// --- Types ---
// Define exactly what this action returns
export type State = { success: boolean; message: string; storeId?: string };

// --- Zod Schemas (The Bouncer) ---
// These ensure the 'config' object matches the selected platform
const ShopifyConfigSchema = z.object({ shopUrl: z.url(), accessToken: z.string().min(10) });
const AmazonConfigSchema = z.object({ apiKey: z.string().min(5), endpoint: z.enum(['US', 'EU']) });
const WooCommerceConfigSchema = z.object({ shopUrl: z.url(), consumerKey: z.string().startsWith('ck_'), consumerSecret: z.string().startsWith('cs_') });

// Main Input Schema
const AddStoreSchema = z.object({
  userId: z.string(),
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  platform: z.enum(EPlatform),

  // Handle "on" (form checkbox) -> boolean
  // HTML forms are weird. If unchecked, they send NOTHING. If checked, they send "on".
  // This line says: "I accept boolean, 'on', or 'true'. Convert ALL of them to a real boolean."
  isSyncEnabled: z.preprocess((val) => val === 'on' || val === 'true' || val === true, z.boolean()),

  // The frontend sends the config as a STRING: '{"shopUrl": "..."}'
  // We need to unpack it (JSON.parse) before checking what's inside.
  config: z
    .string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str); // Try to open the box
      } catch (e) {
        // If it explodes, tell Zod it's invalid
        console.error('🚩 INVALID_JSON_CONFIG in ZOD:', e);
        ctx.addIssue({ code: 'custom', message: 'Invalid JSON config' });
        return z.NEVER;
      }
    })

    // Once opened, we expect a Dictionary (Record) where keys are strings
    .pipe(z.record(z.string(), z.unknown())),
});

export async function addStore(prevState: State, formData: FormData): Promise<State> {
  try {
    // 1. Convert FormData to Plain Object
    const rawData = Object.fromEntries(formData.entries());

    // 1. Basic Input Validation
    const validatedFields = AddStoreSchema.safeParse(rawData);

    if (!validatedFields.success) {
      console.error('🚩 VALIDATION_ERROR:', validatedFields.error);
      return { success: false, message: 'Invalid input format.' };
    }

    const { userId, name, platform, config, isSyncEnabled } = validatedFields.data;

    // 2. Platform-Specific Validation & Identity Extraction
    let configValidation;
    let uniqueIdentity = '';

    // NOTE: TypeScript needs help here to know specific types exist after check
    // Shopify
    if (platform === EPlatform.SHOPIFY) {
      const result = ShopifyConfigSchema.safeParse(config);

      if (result.success) {
        uniqueIdentity = result.data.shopUrl; // Clean URL
        configValidation = result;
      } else configValidation = result;
    }

    // Amazon
    else if (platform === EPlatform.AMAZON) {
      const result = AmazonConfigSchema.safeParse(config);

      if (result.success) {
        uniqueIdentity = result.data.apiKey;
        configValidation = result;
      } else configValidation = result;
    }

    // WooCommerce
    else if (platform === EPlatform.WOOCOMMERCE) {
      const result = WooCommerceConfigSchema.safeParse(config);

      if (result.success) {
        uniqueIdentity = result.data.shopUrl;
        configValidation = result;
      } else configValidation = result;
    }

    // Invalid platform
    else return { success: false, message: 'Invalid platform selected.' };

    if (!configValidation.success) {
      console.error('Validation Errors:', configValidation.error);
      return { success: false, message: `Invalid credentials for ${platform}. Check your inputs.` };
    }

    // 3. Connect to DB
    await connectDB();

    // 4. Create store
    // Note: We deliberately set 'isConnected: false' because we haven't tested the API key yet.
    // The "Adapter" (Phase 2, Step 2) will verify this later.
    const newStore = await Store.create({ userId: new Types.ObjectId(userId), name, platform, storeUrl: uniqueIdentity, config: configValidation.data, isSyncEnabled, isConnected: false });

    // 5. Return sanitized data
    return { success: true, message: 'Store added successfully! Verifying connection...', storeId: newStore._id.toString() };
  } catch (error) {
    console.error('🚩 ADD_STORE_ERROR:', error);

    // --- The Duplicate Key Handler ---
    // Logic: MongoDB throws code 11000 when a unique index is violated.
    // We have a compound index on { userId: 1, name: 1 }
    if (isDuplicateError(error)) {
      const keyPattern = getKeyPattern(error);

      // Check which field caused the error
      if (keyPattern?.storeUrl) return { success: false, message: 'This store is already connected to an account.' };
      if (keyPattern?.name) return { success: false, message: 'You already have a store with this nickname.' };
    }

    return { success: false, message: 'Failed to add store. Please try again.' };
  }
}
