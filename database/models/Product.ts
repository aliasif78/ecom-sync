// ==========================================
// ⚠️ CONSTRAINTS
// ==========================================

// Shopify, WooCommerce & Amazon
// Constraints:

// 1. Shopify & WooCommerce: immediate response,
//    Amazon: async response

// 2. Shopify & Amazon: multiple warehouses
//    WooCommerce: single warehouse

// 3. Shopify allows roughly 2 requests per second. Amazon varies.

// ==========================================
// 📦 Imports
// ==========================================

// Dependencies
import { Schema, models, model, Model, Document } from 'mongoose';

// Constants
import { SHOPIFY, WOOCOMMERCE, AMAZON } from '@/lib/globalConstants';

// ==========================================
// 💿 CONSTANTS
// ==========================================
const SYNCING = 'SYNCING';
const IDLE = 'IDLE';
const FAILED = 'FAILED';
const SYNC_STATES = [IDLE, SYNCING, FAILED];

export const SYNC_STATUS = { IDLE, SYNCING, FAILED } as const;

// ==========================================
// 🚓 INTERFACES
// ==========================================
export interface IInventoryLevel {
  locationId: string;
  quantity: number;
}

export interface IProduct extends Document {
  userId: Schema.Types.ObjectId;
  sku: string;
  name: string;
  price: number;
  image: string;

  mappings: {
    shopify: { productId?: string; variantId?: string };
    amazon: { asin?: string; fulfillmentSku?: string; syncStatus: (typeof SYNC_STATES)[number]; lastSyncError?: string };
    woocommerce: { remoteId?: string };
  };

  stock: number; // Read-only summary
  inventoryByLocation: IInventoryLevel[];
  version: number;

  // Methods
  updateLocationStock(locationId: string, quantity: number): Promise<void>;

  // Virtuals
  readonly isSyncing: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

interface IProductModel extends Model<IProduct> {
  findByPlatformId(platform: typeof SHOPIFY | typeof AMAZON | typeof WOOCOMMERCE, id: string): Promise<IProduct | null>;
}

// ==========================================
// 🏛️ SCHEMA
// ==========================================
const ProductSchema = new Schema<IProduct>(
  {
    // 🔒 OWNERSHIP
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Common
    sku: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true }, // Primary Key - immutable
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },

    // The Adapter Pattern: Mappings strictly typed
    mappings: {
      // Shopify
      shopify: {
        productId: { type: String, sparse: true },
        variantId: { type: String, sparse: true }, // Size/Color
      },

      // Amazon
      amazon: {
        asin: { type: String, sparse: true }, // Amazon Standard Identification Number
        fulfillmentSku: { type: String }, // Amazon Fullfillment SKU
        syncStatus: { type: String, enum: SYNC_STATES, default: IDLE }, // async repsonse
        lastSyncError: { type: String },
      },

      // WooCommerce
      woocommerce: {
        remoteId: { type: String, sparse: true },
      },
    },

    // Current Product State
    stock: { type: Number, required: true, index: true, default: 0 }, // A cached sum of all locations for fast sorting
    inventoryByLocation: [{ _id: false, locationId: { type: String, required: true }, quantity: { type: Number, default: 0 } }], // We may have different warehouses
    version: { type: Number, default: 0 }, // To prevent concurrent updates by > 1 Admins
  },

  // Enable timestamps
  {
    timestamps: true,
    optimisticConcurrency: true, // ⚡️ Auto-handles versioning conflicts
    toJSON: { virtuals: true }, // Ensure virtuals show up when you res.json(product)
    toObject: { virtuals: true },
  }
);

// ==========================================
// ⚡️ VIRTUALS - Variables on the fly
// ==========================================

ProductSchema.virtual('isSyncing').get(function () {
  return this.mappings.amazon.syncStatus === SYNCING;
});

// ==========================================
// 🛡 PRE-HOOKS - The integrity guard
// ==========================================

// PROBLEM: 'stock' and 'inventoryByLocation' can get out of sync.
// SOLUTION: Before every save, recalculate 'stock' from the array.
ProductSchema.pre('save', function () {
  if (!this.isModified('inventoryByLocation')) return;

  const total = this.inventoryByLocation.reduce((sum, item) => sum + item.quantity, 0);
  this.stock = total;
});

// ==========================================
// 🔧 METHODS (Instance Logic)
// ==========================================
ProductSchema.methods.updateLocationStock = async function (locationId: string, newQuantity: number) {
  const locationIndex = this.inventoryByLocation.findIndex((l: IInventoryLevel) => l.locationId === locationId);

  // Location does not exist, add it
  if (locationIndex === -1) this.inventoryByLocation.push({ locationId, quantity: newQuantity });
  // Location exists, update it
  else this.inventoryByLocation[locationIndex].quantity = newQuantity;

  // Finally, save the updated product
  await this.save();

  // TODO: Implement retry logic for VersionError
};

// ==========================================
// 🔍 STATICS (Model Queries)
// ==========================================
ProductSchema.statics.findByPlatformId = async function (platform: typeof SHOPIFY | typeof AMAZON | typeof WOOCOMMERCE, id: string) {
  // We will build up the Mongo DB query dynamically
  const query: { 'mappings.shopify.variantId'?: string; 'mappings.amazon.asin'?: string; 'mappings.woocommerce.remoteId'?: string } = {};

  if (platform === SHOPIFY) query['mappings.shopify.variantId'] = id;
  else if (platform === AMAZON) query['mappings.amazon.asin'] = id;
  else if (platform === WOOCOMMERCE) query['mappings.woocommerce.remoteId'] = id;
  else return null; // 🛡 Guard clause: Return null if platform is invalid

  return this.findOne(query);
};

// ==========================================
// 🏎️ INDEXES - Speed up queries
// ==========================================

// We almost ALWAYS search by "User" + "SKU".
// This index makes that query instant and prevents User A from creating a SKU that User B already has (if you want SKUs to be unique per user).
ProductSchema.index({ userId: 1, sku: 1 }, { unique: true });

// Others, done inside the model definition using the 'index' or 'sparse' options

// ProductSchema.index({ 'mappings.shopify.variantId': 1 });
// ProductSchema.index({ 'mappings.amazon.asin': 1 });

const Product = (models.Product as IProductModel) || model<IProduct, IProductModel>('Product', ProductSchema);
export default Product;
