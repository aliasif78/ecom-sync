// Constants
import { VERIFICATION, ROLES } from '@/lib/globalConstants';

// Interfaces
export interface IConflictSnapshot {
  storeId: string;
  storeName: string; // e.g., "Main Shopify"
  platform: string; // e.g., "shopify", "amazon"
  reportedStock: number; // The conflicting number
}

export interface StoreRow {
  _id: string;
  name: string;
  platform: 'SHOPIFY' | 'AMAZON' | 'WOOCOMMERCE';
  isConnected: boolean;
  isSyncEnabled: boolean;
  lastSyncAt?: string;
  config: Record<string, string>;
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

export interface InventoryAdapter {
  validateConnection(): Promise<{ success: true } | { success: false; message: string }>;
  getProduct(sku: string): Promise<{ sku: string; stock: number; platformId: string } | null>;
  updateStock(sku: string, newStock: number): Promise<{ success: boolean; message: string }>;
}

// Types
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

export type ProductRow = {
  _id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  stockoutRisk: boolean;
  createdAt?: string; // It comes as a string from the server
  updatedAt?: string;

  // 🛑 The Split Brain Flags
  hasConflict: boolean;
  conflictSnapshot: IConflictSnapshot[];
};

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
