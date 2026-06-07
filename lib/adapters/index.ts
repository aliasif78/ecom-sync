// Types
import { InventoryAdapter } from '@/types';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// Adapters
import { MockAdapter } from './mock';

/**
 * Factory that returns the correct `InventoryAdapter` for a given platform.
 *
 * Currently returns `MockAdapter` for all platforms because real Shopify /
 * Amazon / WooCommerce adapters are not yet implemented. When a real adapter
 * is ready, add its `case` here — nothing else in the codebase needs to change.
 *
 * @param platform - The e-commerce platform of the store being synced
 * @param config   - The store's credential config (API keys, URLs, etc.)
 * @returns        An `InventoryAdapter` ready to call `updateStock` / `getProduct`
 */
export function getAdapter(platform: EPlatform, config: Record<string, unknown>): InventoryAdapter {
  switch (platform) {
    // Real adapters slot in here as cases when they are built:
    // case EPlatform.SHOPIFY:
    //   return new ShopifyAdapter(config);
    // case EPlatform.AMAZON:
    //   return new AmazonAdapter(config);
    // case EPlatform.WOOCOMMERCE:
    //   return new WooCommerceAdapter(config);

    default:
      // Mock adapter is platform-aware so it generates correctly-formatted
      // fake platform IDs (Shopify GIDs, Amazon ASINs, WooCommerce numeric IDs).
      return new MockAdapter(platform, config);
  }
}
