export const SHOPIFY = 'SHOPIFY';
export const AMAZON = 'AMAZON';
export const WOOCOMMERCE = 'WOOCOMMERCE';
export const MANUAL = 'MANUAL';
export const PLATFORMS = [SHOPIFY, AMAZON, WOOCOMMERCE, MANUAL];

export enum EPlatform {
  SHOPIFY = 'SHOPIFY',
  AMAZON = 'AMAZON',
  WOOCOMMERCE = 'WOOCOMMERCE',
  MANUAL = 'MANUAL',
}

export const DEF_LOC_ID = 'WAREHOUSE_MAIN';

// Role
export const USER = 'USER';
export const ADMIN = 'ADMIN';
export const ROLES = [USER, ADMIN];

// Email
export const VERIFIED = 'Verified';
export const NOT_VERIFIED = 'Not Verified';
export const VERIFICATION = [VERIFIED, NOT_VERIFIED];

// Sync Mutex
export const MUTEX_ALL = 'ALL';

// Products — pagination
export const DEFAULT_PRODUCTS_PAGE_SIZE = 10;
export const MAX_PRODUCTS_PAGE_SIZE = 50;

// Products — stock status
export const LOW_STOCK_THRESHOLD = 10;

// Stores — pagination
export const DEFAULT_STORES_PAGE_SIZE = 10;
export const MAX_STORES_PAGE_SIZE = 50;
