'use server';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// BE Functions
import { authGuard } from '@/lib/safe-action';
import { addStore, deleteStoreById, editStoreById, getStoresByUserId, getStoreStats, StoreFieldErrors } from '@/lib/stores';

// ---------------------------------------------------------------------------
// addStoreAction
// ---------------------------------------------------------------------------

/**
 * Server Action — connect a new store.
 * Typed with `StoreFieldErrors` so the client can surface per-field messages
 * directly in the form rather than showing a generic toast.
 */
export async function addStoreAction(data: { name: string; platform: EPlatform; config: Record<string, unknown>; isSyncEnabled: boolean }) {
  const { name, platform, config, isSyncEnabled } = data;
  if (!name || !platform || !config || isSyncEnabled === undefined) return { success: false, message: 'Missing required fields' };

  return authGuard<{ fieldErrors?: StoreFieldErrors; storeId?: string }>('ADD_STORE', '/stores', (userId) => addStore({ userId, ...data }));
}

// ---------------------------------------------------------------------------
// getStoresByUserIdAction
// ---------------------------------------------------------------------------

export async function getStoresByUserIdAction() {
  return authGuard('GET_STORES_BY_USER_ID', null, (userId) => getStoresByUserId({ userId }));
}

// ---------------------------------------------------------------------------
// getStoreStatsAction
// ---------------------------------------------------------------------------

/**
 * Server action that returns aggregated store statistics for the currently
 * authenticated user.  Delegates to a single MongoDB aggregation — no N+1.
 */
export async function getStoreStatsAction() {
  return authGuard('GET_STORE_STATS', null, (userId) => getStoreStats({ userId }));
}

// ---------------------------------------------------------------------------
// deleteStoreByIdAction
// ---------------------------------------------------------------------------

export async function deleteStoreByIdAction(storeId: string) {
  if (!storeId) return { success: false, message: 'Missing required fields' };
  return authGuard('DELETE_STORE_BY_ID', '/stores', (userId) => deleteStoreById({ storeId, userId }));
}

// ---------------------------------------------------------------------------
// editStoreByIdAction
// ---------------------------------------------------------------------------

/**
 * Server Action — update an existing store's settings and/or credentials.
 * Typed with `StoreFieldErrors` so the client can surface per-field messages
 * directly in the form rather than showing a generic toast.
 */
export async function editStoreByIdAction(storeId: string, data: { name?: string; config?: Record<string, unknown>; isSyncEnabled?: boolean }) {
  const { name, config, isSyncEnabled } = data;
  if (!storeId || (!name && !config && isSyncEnabled === undefined)) return { success: false, message: 'Missing required fields' };

  return authGuard<{ fieldErrors?: StoreFieldErrors }>('EDIT_STORE_BY_ID', '/stores', (userId) => editStoreById({ storeId, userId, ...data }));
}
