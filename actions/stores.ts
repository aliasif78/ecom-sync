'use server';

// Database
import { EPlatform } from '@/lib/globalConstants';

// BE Functions
import { authGuard } from '@/lib/safe-action';
import { addStore, deleteStoreById, editStoreById, getStoresByUserId } from '@/lib/stores';

export async function addStoreAction(data: { name: string; platform: EPlatform; config: Record<string, unknown>; isSyncEnabled: boolean }) {
  // 1. Input Validation
  const { name, platform, config, isSyncEnabled } = data;
  if (!name || !platform || !config || isSyncEnabled === undefined) return { success: false, message: 'Missing required fields' };

  // 2. Run the BE function
  return authGuard('ADD_STORE', '/stores', (userId) => addStore({ userId, ...data }));
}

export async function getStoresByUserIdAction() {
  return authGuard('GET_STORES_BY_USER_ID', null, (userId) => getStoresByUserId({ userId }));
}

export async function deleteStoreByIdAction(storeId: string) {
  // 1. Input Validation
  if (!storeId) return { success: false, message: 'Missing required fields' };

  // 2. Run the BE function
  return authGuard('DELETE_STORE_BY_ID', '/stores', (userId) => deleteStoreById({ storeId, userId }));
}

export async function editStoreByIdAction(storeId: string, data: { name?: string; config?: Record<string, unknown>; isSyncEnabled?: boolean }) {
  // 1. Input Validation
  const { name, config, isSyncEnabled } = data;
  if (!storeId || (!name && !config && isSyncEnabled === undefined)) return { success: false, message: 'Missing required fields' };

  // 2. Run the BE function
  return authGuard('EDIT_STORE_BY_ID', '/stores', (userId) => editStoreById({ storeId, userId, ...data }));
}
