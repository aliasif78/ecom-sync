// Types
import { InventoryAdapter } from '@/types';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// ==========================================
// 🔢 PURE HELPERS
// ==========================================

/**
 * Produces a stable, unsigned 32-bit integer from a SKU string.
 * Uses the classic djb2 algorithm — same SKU always yields the same number,
 * which is what makes our mock platform IDs deterministic across restarts.
 *
 * @param sku - The product SKU (e.g. "SHOES-001")
 * @returns A non-negative integer derived from the SKU
 */
function skuHash(sku: string): number {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash = (hash << 5) - hash + sku.charCodeAt(i);
    hash |= 0; // Coerce to signed 32-bit int
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic, platform-appropriate fake platform ID from a SKU.
 * The format mirrors what each real platform's API would return, so when we
 * swap in a real adapter later the stored IDs look identical in shape.
 *
 * Shopify  → `gid://shopify/ProductVariant/<hash>`  (Shopify GID format)
 * Amazon   → `B0<8-char-alphanumeric>`              (ASIN format)
 * WooComm. → `"<5-digit-number>"`                   (numeric string WC returns)
 * Default  → `mock_<sku>_<hash>`
 *
 * @param platform - The target e-commerce platform
 * @param sku      - The product SKU
 * @returns A stable fake platform ID string
 */
function buildPlatformId(platform: EPlatform, sku: string): string {
  const hash = skuHash(sku);

  switch (platform) {
    case EPlatform.SHOPIFY:
      return `gid://shopify/ProductVariant/${hash}`;

    case EPlatform.AMAZON: {
      // ASINs are exactly 10 chars: 'B0' + 8 uppercase alphanumerics
      const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const suffix = Array.from({ length: 8 }, (_, i) => CHARSET[(hash + i * 31) % CHARSET.length]).join('');
      return `B0${suffix}`;
    }

    case EPlatform.WOOCOMMERCE:
      // WooCommerce returns a plain numeric string as the product ID
      return String((hash % 90_000) + 10_000); // always 5 digits

    default:
      return `mock_${sku.toLowerCase()}_${hash}`;
  }
}

// ==========================================
// 🎭 MOCK ADAPTER
// ==========================================

/**
 * A realistic mock implementation of `InventoryAdapter` with intentional
 * random failure injection.
 *
 * Design principles:
 * - **Random failures** — `validateConnection` and `updateStock` each have a
 *   50 % chance of failing on any given call. This is deliberate: it exercises
 *   Inngest's per-step retry logic and the `onFailure` handler so those
 *   resilience features are visibly demonstrated in the dashboard.
 *   Chaos Mode (the navbar toggle) operates at the server-action layer and is
 *   a separate, independent failure mechanism.
 * - **Deterministic IDs** — `getProduct()` always returns the same `platformId`
 *   for the same SKU + platform combination so stored `mappings` values in
 *   MongoDB are stable across server restarts and Inngest replays.
 * - **Artificial delay** — timeouts simulate real network latency so the full
 *   async flow (Pusher events, mutex unlock, UI update) can be tested end-to-end.
 */
export class MockAdapter implements InventoryAdapter {
  private readonly platform: EPlatform;
  private readonly config: Record<string, unknown>;

  /**
   * @param platform - The e-commerce platform this store belongs to.
   *                   Drives the format of generated fake platform IDs.
   * @param config   - The store's credential config (unused by mock, but
   *                   matches the real adapter signature for drop-in replacement).
   */
  constructor(platform: EPlatform, config: Record<string, unknown>) {
    this.platform = platform;
    this.config = config;
  }

  /**
   * Simulates an OAuth / API key handshake.
   *
   * Has a 50 % chance of returning a connection failure to demonstrate that
   * the store-verification flow handles credential rejection gracefully.
   */
  async validateConnection(): Promise<{ success: true } | { success: false; message: string }> {
    console.log(`🔌 [MOCK:${this.platform}] Validating connection...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (Math.random() < 0.5) {
      console.warn(`⛔️ [MOCK:${this.platform}] Simulated connection failure.`);
      return { success: false, message: 'Simulated connection failure' };
    }

    console.log(`✅ [MOCK:${this.platform}] Connection valid.`);
    return { success: true };
  }

  /**
   * Simulates fetching a product listing from the platform.
   * Returns a stable `platformId` derived deterministically from the SKU —
   * the same SKU on the same platform always produces the same ID.
   *
   * This is called by `syncStockToStores` on the *first* sync to a store,
   * to obtain the platform ID that gets written into `product.mappings`.
   *
   * @param sku - The internal product SKU to look up
   */
  async getProduct(sku: string): Promise<{ sku: string; stock: number; platformId: string } | null> {
    console.log(`🔍 [MOCK:${this.platform}] Fetching product "${sku}"...`);
    const platformId = buildPlatformId(this.platform, sku);
    console.log(`📦 [MOCK:${this.platform}] Found "${sku}" → platformId: ${platformId}`);
    return { sku, stock: 0, platformId };
  }

  /**
   * Simulates pushing a stock update to the platform.
   *
   * Has a 50 % chance of throwing an error, which causes Inngest to treat
   * this step as failed and schedule a retry. This is the primary mechanism
   * for demonstrating Inngest's per-step retry isolation in the dashboard:
   * a failing Shopify step is retried independently without re-running the
   * already-successful Amazon or WooCommerce steps.
   *
   * In a real adapter this would be the Shopify `PUT /variants/:id.json`,
   * the Amazon `UpdateInventory` call, or the WooCommerce `PUT /products/:id`.
   *
   * @param sku      - The SKU whose stock is being updated
   * @param newStock - The new absolute stock quantity to push
   */
  async updateStock(sku: string, newStock: number): Promise<{ success: boolean; message: string }> {
    console.log(`🚀 [MOCK:${this.platform}] Pushing stock update: "${sku}" → ${newStock} units`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (Math.random() < 0.5) {
      console.warn(`⛔️ [MOCK:${this.platform}] Simulated platform API failure — Inngest will retry.`);
      throw new Error(`[MOCK:${this.platform}] Platform API is down (Simulated Error)`);
    }

    console.log(`✅ [MOCK:${this.platform}] Stock update confirmed.`);
    return { success: true, message: `[MOCK:${this.platform}] Stock updated to ${newStock}` };
  }
}
