import { NextResponse } from 'next/server';
import { getAdapter } from '@/lib/adapters'; // Your factory
import { EPlatform } from '@/lib/globalConstants';

export async function GET() {
  try {
    console.log('🧪 Starting Adapter Test...');

    // 1. Ask the Factory for an Amazon Adapter (which maps to Mock)
    // We pass a fake config
    const adapter = getAdapter(EPlatform.AMAZON, { apiKey: 'test_123' });

    // 2. Test Connection
    const auth = await adapter.validateConnection();
    console.log('🔐 Auth Check:', auth);

    // 3. Test Stock Update (Should take ~1 second)
    const update = await adapter.updateStock('SKU-TEST-001', 50);
    console.log('📦 Stock Update:', update);

    return NextResponse.json({
      success: true,
      platform: 'AMAZON (Mock)',
      auth,
      update,
    });
  } catch (error) {
    console.error('💥 Adapter Test Failed:', error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
