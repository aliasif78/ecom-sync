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
import { Schema, models, model, Model, Document, Types, Query } from 'mongoose';

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
  _id?: Types.ObjectId;
  locationId: string;
  quantity: number;
}

/**
 * A single platform's mapping entry on a product.
 * `storeId`      — FK to the Store document that owns this listing.
 *                  Populated on the first successful sync; null until then.
 * `lastSyncedAt` — Timestamp of the last successful push to this platform.
 *                  Used by the UI to show "last synced X minutes ago".
 */
interface IShopifyMapping {
  storeId?: Types.ObjectId; // ref: 'Store' — written on first sync
  productId?: string;
  variantId?: string; // The Shopify GID returned by the adapter
  lastSyncedAt?: Date;
}

interface IAmazonMapping {
  storeId?: Types.ObjectId; // ref: 'Store' — written on first sync
  asin?: string; // Amazon Standard Identification Number
  fulfillmentSku?: string; // Amazon Fulfillment SKU
  syncStatus: (typeof SYNC_STATES)[number];
  lastSyncError?: string;
  lastSyncedAt?: Date;
}

interface IWooCommerceMapping {
  storeId?: Types.ObjectId; // ref: 'Store' — written on first sync
  remoteId?: string; // WooCommerce numeric product ID (as string)
  lastSyncedAt?: Date;
}

export interface IProduct extends Document {
  userId: Types.ObjectId;
  sku: string;
  name: string;
  price: number;
  image: string;

  /**
   * Platform mappings — the bridge between this internal product and its
   * live listings on external platforms.
   *
   * Lifecycle:
   *   1. Product created → all mapping slots are empty (storeId = undefined).
   *   2. First sync to a store → Inngest adapter writes storeId + platformId.
   *   3. Subsequent syncs → adapter updates stock; lastSyncedAt is stamped.
   *
   * Constraint: one active store per platform per product (MVP).
   * A product can be on Shopify, Amazon, and WooCommerce simultaneously,
   * but only one Shopify store, one Amazon store, and one WooCommerce store.
   */
  mappings: {
    shopify: IShopifyMapping;
    amazon: IAmazonMapping;
    woocommerce: IWooCommerceMapping;
  };

  stock: number; // Read-only cached sum of all inventoryByLocation quantities
  inventoryByLocation: IInventoryLevel[];
  version: number;

  // Analytics
  recentSalesVelocity: number; // Rolling 14-day average units sold per day
  // ⚠️ REMOVED (Feature 2 cleanup): stockoutRisk / lastRiskAnalysis. These
  // were only ever written by lib/inngest/functions/smartStockout.ts, which
  // has been deleted and replaced by the anomaly agent's STOCKOUT_RISK alert
  // type. Nothing writes these fields anymore — leaving them would mean a
  // dead field silently frozen at its last value forever. The products-page
  // "Stockout Risk" badge now reads live Alert data instead — see
  // lib/alerts/index.ts's getOpenStockoutRiskProductIds and ProductTable.tsx.

  // Status
  isArchived: boolean;
  archivedAt?: Date;

  // Methods
  updateLocationStock(locationId: string, quantity: number): Promise<void>;
  softDelete(): Promise<void>;

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
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    // Common fields
    sku: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
    image: { type: String, required: true },

    // ---------------------------------------------------------------------------
    // The Adapter Pattern: platform mappings
    //
    // `storeId` on each sub-document is the FK to the Store collection.
    // It is intentionally optional — it is only written after the first
    // successful sync via the Inngest `syncStockToStores` function.
    // ---------------------------------------------------------------------------
    mappings: {
      // Shopify
      shopify: {
        storeId: { type: Types.ObjectId, ref: 'Store', default: undefined },
        productId: { type: String, sparse: true },
        variantId: { type: String, sparse: true }, // Shopify GID e.g. gid://shopify/ProductVariant/123
        lastSyncedAt: { type: Date, default: undefined },
      },

      // Amazon
      amazon: {
        storeId: { type: Types.ObjectId, ref: 'Store', default: undefined },
        asin: { type: String, sparse: true }, // Amazon Standard Identification Number
        fulfillmentSku: { type: String }, // Amazon Fulfillment SKU
        syncStatus: { type: String, enum: SYNC_STATES, default: IDLE }, // Async response flow
        lastSyncError: { type: String },
        lastSyncedAt: { type: Date, default: undefined },
      },

      // WooCommerce
      woocommerce: {
        storeId: { type: Types.ObjectId, ref: 'Store', default: undefined },
        remoteId: { type: String, sparse: true }, // WooCommerce numeric product ID (as string)
        lastSyncedAt: { type: Date, default: undefined },
      },
    },

    // Current Product State
    stock: { type: Number, required: true, index: true, default: 0 }, // Cached sum — rebuilt on every save
    inventoryByLocation: [{ _id: false, locationId: { type: String, required: true }, quantity: { type: Number, default: 0 } }],
    version: { type: Number, default: 0 }, // Optimistic concurrency — prevents concurrent-admin conflicts

    // Analytics
    recentSalesVelocity: { type: Number, default: 0 },
    // ⚠️ stockoutRisk / lastRiskAnalysis fields REMOVED here — see interface comment above.

    // 🗑️ Soft Delete Flags
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
  },

  {
    timestamps: true,
    optimisticConcurrency: true, // ⚡️ Auto-handles versioning conflicts
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==========================================
// ⚡️ VIRTUALS
// ==========================================

ProductSchema.virtual('isSyncing').get(function () {
  return this.mappings.amazon.syncStatus === SYNCING;
});

// ==========================================
// 🛡 PRE-HOOKS
// ==========================================

// Keep `stock` in sync with `inventoryByLocation` automatically.
ProductSchema.pre('save', function () {
  if (!this.isModified('inventoryByLocation')) return;
  this.stock = this.inventoryByLocation.reduce((sum, item) => sum + item.quantity, 0);
});

// Exclude archived products from all standard queries automatically.
ProductSchema.pre(/^find/, function (this: Query<unknown, IProduct>) {
  if (this.getFilter().isArchived === undefined) this.where({ isArchived: { $ne: true } });
});

// ==========================================
// 🔧 METHODS (Instance Logic)
// ==========================================

ProductSchema.methods.updateLocationStock = async function (locationId: string, newQuantity: number) {
  const locationIndex = this.inventoryByLocation.findIndex((l: IInventoryLevel) => l.locationId === locationId);

  if (locationIndex === -1) this.inventoryByLocation.push({ locationId, quantity: newQuantity });
  else this.inventoryByLocation[locationIndex].quantity = newQuantity;

  await this.save();
  // TODO: Implement retry logic for VersionError
};

ProductSchema.methods.softDelete = async function () {
  this.isArchived = true;
  this.archivedAt = new Date();
  await this.save();
};

// ==========================================
// 🔍 STATICS (Model Queries)
// ==========================================

ProductSchema.statics.findByPlatformId = async function (platform: typeof SHOPIFY | typeof AMAZON | typeof WOOCOMMERCE, id: string) {
  const query: { 'mappings.shopify.variantId'?: string; 'mappings.amazon.asin'?: string; 'mappings.woocommerce.remoteId'?: string } = {};

  if (platform === SHOPIFY) query['mappings.shopify.variantId'] = id;
  else if (platform === AMAZON) query['mappings.amazon.asin'] = id;
  else if (platform === WOOCOMMERCE) query['mappings.woocommerce.remoteId'] = id;
  else return null;

  return this.findOne(query);
};

// ==========================================
// 🏎️ INDEXES
// ==========================================

// Combined index: instant lookup by owner + SKU, enforces per-user SKU uniqueness.
ProductSchema.index({ userId: 1, sku: 1 }, { unique: true });

const Product = (models.Product as IProductModel) || model<IProduct, IProductModel>('Product', ProductSchema);
export default Product;
