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
// DEFAULT: page size when the caller doesn't specify one.
// MAX: hard ceiling enforced server-side in getProducts, regardless of
// what a caller (or a hand-edited request) asks for.
export const DEFAULT_PRODUCTS_PAGE_SIZE = 10;
export const MAX_PRODUCTS_PAGE_SIZE = 50;

// Products — stock status
// Single source of truth for the "low stock" cutoff. Previously this was
// hardcoded as the literal `10` independently in ProductTable.tsx's
// getStockStatus AND in app/products/page.tsx's header-stat calculation —
// two copies that could silently drift apart. Now there's one constant,
// used by both the aggregation in lib/products/index.ts and the per-row
// badge logic in ProductTable.tsx.
export const LOW_STOCK_THRESHOLD = 10;
