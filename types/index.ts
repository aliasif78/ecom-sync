// ==========================================
// 📦 SHARED CLIENT / SERVER TYPES
//
// These are the serialized ("Row") shapes that cross the server→client
// boundary. They mirror the Mongoose document interfaces but with all
// ObjectIds and Dates converted to strings (safe for JSON serialization
// and Next.js server→client prop passing).
// ==========================================

// ==========================================
// 🏪 STORE TYPES
// ==========================================

/**
 * Serialized Store document — safe to pass as a React prop.
 * Mirrors `IStore` from the Mongoose model with ObjectIds → strings.
 */
export interface StoreRow {
  _id: string;
  name: string;
  platform: string; // EPlatform value (e.g. 'SHOPIFY', 'AMAZON', 'WOOCOMMERCE')
  isConnected: boolean; // True after credential validation passes
  isSyncEnabled: boolean; // User toggle — controls participation in sync jobs
  lastSyncAt?: string; // ISO string; undefined if the store has never synced
  config: Record<string, string>; // Platform credentials (encrypted at rest)
}

/**
 * Aggregated stats derived from the user's store collection.
 * Computed server-side via a single MongoDB aggregation pipeline.
 */
export interface StoreStats {
  /** Number of Shopify stores owned by the user. */
  shopify: number;
  /** Number of Amazon stores owned by the user. */
  amazon: number;
  /** Number of WooCommerce stores owned by the user. */
  woocommerce: number;
  /** Number of stores with `isConnected: true`. */
  connected: number;
  /** Number of stores with `isSyncEnabled: true`. */
  synced: number;
}

/**
 * Form state for the Add / Edit Store modals.
 * All fields are optional because the form is platform-conditional:
 * only the fields relevant to the selected platform are shown.
 */
export interface StoreFormState {
  // Common
  name?: string;
  isSyncEnabled?: boolean;

  // Shopify
  storeUrl?: string;
  accessToken?: string;

  // Amazon
  apiKey?: string;
  endpoint?: string;

  // WooCommerce
  consumerKey?: string;
  consumerSecret?: string;
}

// ==========================================
// 📦 PRODUCT TYPES
// ==========================================

/**
 * A single platform mapping entry on a serialized ProductRow.
 *
 * `storeId`      — The `_id` of the Store document this product is linked to
 *                  on this platform. Undefined until the first successful sync.
 * `lastSyncedAt` — ISO timestamp of the last successful stock push to this
 *                  platform. Used by the UI for "last synced X ago" display.
 */
interface ShopifyMappingRow {
  storeId?: string; // Store._id (written on first sync)
  productId?: string;
  variantId?: string; // Shopify GID e.g. gid://shopify/ProductVariant/123
  lastSyncedAt?: string; // ISO string
}

interface AmazonMappingRow {
  storeId?: string; // Store._id (written on first sync)
  asin?: string; // Amazon Standard Identification Number
  fulfillmentSku?: string;
  syncStatus: string; // 'IDLE' | 'SYNCING' | 'FAILED'
  lastSyncError?: string;
  lastSyncedAt?: string; // ISO string
}

interface WooCommerceMappingRow {
  storeId?: string; // Store._id (written on first sync)
  remoteId?: string; // WooCommerce numeric product ID (as string)
  lastSyncedAt?: string; // ISO string
}

/**
 * Serialized Product document — safe to pass as a React prop.
 * Mirrors `IProduct` from the Mongoose model with ObjectIds → strings
 * and Dates → ISO strings.
 *
 * Mapping lifecycle:
 *   1. Product created  → all `storeId` fields are undefined
 *   2. First sync fires → Inngest writes `storeId` + `platformId` + `lastSyncedAt`
 *   3. Future syncs     → only `lastSyncedAt` is updated
 */
export interface ProductRow {
  _id: string;
  userId: string;
  sku: string;
  name: string;
  price: number;
  image: string;

  /**
   * Platform mappings — the bridge between this product and its live listings.
   * Each slot corresponds to one external platform. A slot's `storeId` being
   * undefined means this product has not yet been synced to that platform.
   */
  mappings: {
    shopify: ShopifyMappingRow;
    amazon: AmazonMappingRow;
    woocommerce: WooCommerceMappingRow;
  };

  stock: number; // Cached sum of all locations
  inventoryByLocation: { _id?: string; locationId: string; quantity: number }[];
  version: number; // Optimistic concurrency token

  // Analytics & AI
  recentSalesVelocity: number; // Rolling 14-day average units sold per day
  stockoutRisk: boolean;
  lastRiskAnalysis: string | null; // ISO string or null

  // Status
  isArchived: boolean;
  archivedAt?: string; // ISO string

  // Virtuals (included via toJSON: { virtuals: true })
  isSyncing?: boolean; // True when mappings.amazon.syncStatus === 'SYNCING'

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 📋 INVENTORY TYPES
// ==========================================

/**
 * Reasons a stock level can change.
 * Stored on every InventoryLedger entry for audit trail purposes.
 */
export enum InventoryReason {
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  RETURN_RESTOCK = 'RETURN_RESTOCK',
  DAMAGED_GOODS = 'DAMAGED_GOODS',
  THEFT_OR_LOSS = 'THEFT_OR_LOSS',
  RECEIVED_INVENTORY = 'RECEIVED_INVENTORY',
}

// ==========================================
// 🔌 ADAPTER TYPES
// ==========================================

/**
 * Contract that every platform adapter must satisfy.
 *
 * `validateConnection` — called once when a store is added; verifies credentials.
 * `getProduct`         — called on first sync; returns the platform-assigned ID.
 * `updateStock`        — called on every sync; pushes the new absolute quantity.
 *
 * All methods are async and return discriminated unions so callers can handle
 * failures without try/catch at the call site.
 */
export interface InventoryAdapter {
  validateConnection(): Promise<{ success: true } | { success: false; message: string }>;
  getProduct(sku: string): Promise<{ sku: string; stock: number; platformId: string } | null>;
  updateStock(sku: string, newStock: number): Promise<{ success: boolean; message: string }>;
}

// ==========================================
// 🔐 AUTH TYPES
// ==========================================

/** Form values for the login page. */
export interface LoginFormValues {
  email: string;
  password: string;
}

/**
 * Form values for the sign-up page.
 * `stores` captures the initial platform shop names collected during
 * onboarding and written to the MongoDB User document on creation.
 */
export interface SignUpFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  stores: {
    shopify: string;
    amazon: string;
    woocommerce: string;
  };
}
