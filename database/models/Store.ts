// ==========================================
// ⚠️ CONSTRAINTS
// ==========================================

// A user can have many stores, even of the same type, e.g. 2 Shopify stores, 3 Amazon stores, 1 WooCommerce store, etc.
// When the user was actually adding the product to a store online, they set a SKU for it. This was the same unique identifier for every online store that they added the product to. We will use this SKU to fetch stores containing the target product.
// Only adding support for Shopify, Amazon (fake) & WooCommerce right now.

// ==========================================
// 📦 Imports
// ==========================================

// Dependencies
import { Schema, models, model, Document, Types } from 'mongoose';

// Types
import { EPlatform } from '@/lib/globalConstants';

// ==========================================
// 💿 CONSTANTS
// ==========================================

// ==========================================
// 🚓 INTERFACES
// ==========================================
interface IStore extends Document {
  // General
  userId: Types.ObjectId;
  platform: EPlatform;
  name: string;

  // Flexible config object to handle different platforms
  // ⚠️ We use 'any' or 'Record<string, any>' here because the shape changes
  // depending on the platform. The Validation Layer (Zod) handles the strict typing.
  config: Record<string, unknown>;

  // Status
  isConnected: boolean; // Validated?
  isSyncEnabled: boolean; // Master switch

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// 🏛️ SCHEMA
// ==========================================

const StoreSchema = new Schema<IStore>(
  {
    // General
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: Object.values(EPlatform), required: true },
    name: { type: String, required: true },

    // Config
    config: { select: false, type: Schema.Types.Mixed, default: {} },

    // Status
    isConnected: { type: Boolean, default: false },
    isSyncEnabled: { type: Boolean, default: true },
  },

  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ==========================================
// ⛑️ HELPERS
// ==========================================

// ==========================================
// ⚡️ VIRTUALS - Variables on the fly
// ==========================================

// ==========================================
// 🛡 PRE-HOOKS - The integrity guard
// ==========================================

// ==========================================
// 🔧 METHODS (Instance Logic)
// ==========================================

// ==========================================
// 🔍 STATICS (Model Queries)
// ==========================================

// ==========================================
// 🏎️ INDEXES - Speed up queries
// ==========================================

// 1. User can look up stores by platform fast
StoreSchema.index({ userId: 1, platform: 1 });

// 2. User cannot have two stores with the same name (UX Protection)
StoreSchema.index({ userId: 1, name: 1 }, { unique: true });

// Others, done inside the model definition using the 'index' or 'sparse' options

const Store = models.Store || model<IStore>('Store', StoreSchema);
export default Store;
