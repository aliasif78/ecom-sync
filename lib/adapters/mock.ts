// Interfaces
import { InventoryAdapter } from '@/types';

export class MockAdapter implements InventoryAdapter {
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  async validateConnection(): Promise<{ success: true } | { success: false; message: string }> {
    console.log('🔌 [MOCK] Validating connection...', this.config.apiKey);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate a random connection error
    if (Math.random() < 0.2) return { success: false, message: 'Simulated connection failure' };
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
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate a random failure
    const rand = Math.random();
    console.log('Random number:', rand);

    if (rand < 0.2) {
      console.log('⛔️ ERROR UPDATING STOCK RETRY ⛔️');
      throw new Error('Platform API is down (Simulated Error)');
    }

    // 30% chance of success
    console.log('✅ SUCCESSFULLY UPDATED STOCK ✅');
    return { success: true, message: 'Stock updated successfully' };
  }
}
