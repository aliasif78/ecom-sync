// Interfaces
import { InventoryAdapter } from '@/types';

export class MockAdapter implements InventoryAdapter {
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async validateConnection(): Promise<{ success: true } | { success: false; message: string }> {
    console.log('🔌 [MOCK] Validating connection...', this.config.apiKey);

    // Simulate a random connection error
    if (Math.random() < 0.1) return { success: false, message: 'Simulated connection failure' };
    return { success: true };
  }

  async getProduct(sku: string): Promise<{ sku: string; stock: number; platformId: string } | null> {
    console.log(`🔍 [MOCK] Fetching product ${sku}...`);

    // Return a dummy product
    return { sku, stock: 17, platformId: `mock_${sku}_123` };
  }

  async updateStock(sku: string, newStock: number): Promise<{ success: boolean; message: string }> {
    console.log(`🚀 [MOCK] Updating ${sku} to stock: ${newStock}`);

    // Simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate a random failure
    if (Math.random() < 0.1) return { success: false, message: 'Simulated update failure' };

    // 90% chance of success
    return { success: true, message: 'Stock updated successfully' };
  }
}
