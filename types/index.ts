// Constants
import { VERIFICATION, ROLES } from '@/lib/globalConstants';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type LoginFormValues = {
  email: string;
  password: string;
};

export type SignUpFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;

  stores: {
    shopify?: string;
    amazon?: string;
    woocommerce?: string;
  };
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserTableRow = {
  _id: string;
  name: string;
  email: string;
  role: (typeof ROLES)[number];
  status: (typeof VERIFICATION)[number];
  lastActive: string;
  createdAt: string;
  profilePicture?: string;
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductRow = {
  _id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  stockoutRisk: boolean;
  createdAt?: string; // Comes as a string from the server
  updatedAt?: string;
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export enum InventoryReason {
  // --- USER SELECTABLE (Show in Popup) ---
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT', // "Just fixing the count"
  DAMAGED_GOODS = 'DAMAGED_GOODS', // "Box fell off the truck"
  THEFT_OR_LOSS = 'THEFT_OR_LOSS', // "It's gone and I don't know why"
  RETURN_RESTOCK = 'RETURN_RESTOCK', // "Customer returned item manually"
  RECEIVED_INVENTORY = 'RECEIVED_INVENTORY', // "New shipment arrived"

  // --- SYSTEM ONLY (Hidden from Popup) ---
  ORDER_FULFILLMENT = 'ORDER_FULFILLMENT', // Triggered by Shopify/Amazon Order
  ORDER_CANCELLATION = 'ORDER_CANCELLATION', // Triggered by cancelling an order
  INITIAL_COUNT = 'INITIAL_COUNT', // Triggered when product is created
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export interface StoreRow {
  _id: string;
  name: string;
  platform: 'SHOPIFY' | 'AMAZON' | 'WOOCOMMERCE';
  isConnected: boolean;
  isSyncEnabled: boolean;
  lastSyncAt?: string;
  config: Record<string, string>;
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

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

export interface InventoryAdapter {
  validateConnection(): Promise<{ success: true } | { success: false; message: string }>;
  getProduct(sku: string): Promise<{ sku: string; stock: number; platformId: string } | null>;
  updateStock(sku: string, newStock: number): Promise<{ success: boolean; message: string }>;
}
