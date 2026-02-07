'use server';

// Database
import { EPlatform } from '@/lib/globalConstants';

// BE Functions
import { authGuard } from '@/lib/safe-action';
import { addStore } from '@/lib/stores';

export async function addStoreAction(data: { name: string; platform: EPlatform; config: Record<string, unknown>; isSyncEnabled: boolean }) {
  // 1. Input Validation
  const { name, platform, config, isSyncEnabled } = data;
  if (!name || !platform || !config || isSyncEnabled === undefined) return { success: false, message: 'Missing required fields' };
  console.log(config);

  // 2. Run the BE function
  return authGuard('ADD_STORE', '/stores', (userId) => addStore({ userId, ...data }));
}
