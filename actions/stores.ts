'use server';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// Auth wrapper
import { authGuard } from '@/lib/safe-action';

// Library functions
import { addStore, deleteStoreById, editStoreById, getStoresByUserId, getStoreStats } from '@/lib/stores';

// Types — used to explicitly parameterise authGuard so TypeScript does not
// narrow `fieldErrors` to `undefined` via union inference (see editStoreByIdAction).
import type { StoreFieldErrors } from '@/lib/stores';

// Inngest client — used to dispatch the async connection-verification job
import { inngest } from '@/lib/inngest/client';

// ---------------------------------------------------------------------------
// addStoreAction
// ---------------------------------------------------------------------------

/**
 * Creates a new store document (always with `isConnected: false`), then
 * immediately dispatches a `store/store.added` event to Inngest.
 *
 * The Inngest function `verifyStoreConnection` picks that event up,
 * calls `adapter.validateConnection()`, flips `isConnected` in MongoDB,
 * and pushes the result to the client via Pusher — all asynchronously
 * so the user is never blocked waiting for the external API handshake.
 */
export async function addStoreAction(data: { name: string; platform: EPlatform; config: Record<string, unknown>; isSyncEnabled: boolean }) {
  // 1. Input validation
  const { name, platform, config, isSyncEnabled } = data;
  if (!name || !platform || !config || isSyncEnabled === undefined) {
    return { success: false, message: 'Missing required fields' };
  }

  // 2. Auth + business logic
  return authGuard('ADD_STORE', '/stores', async (userId) => {
    const result = await addStore({ userId, ...data });

    // 3. Kick off async credential verification via Inngest.
    //    Only fires when the store document was actually created.
    //    The job writes isConnected → true/false and notifies the client via Pusher.
    if (result.success && result.storeId) {
      await inngest.send({
        name: 'store/store.added',
        data: { storeId: result.storeId, userId },
      });
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// getStoresByUserIdAction
// ---------------------------------------------------------------------------

/**
 * Returns all stores belonging to the authenticated user.
 *
 * Also surfaces `userId` in the response so the Stores page can subscribe
 * to the correct Pusher channel for real-time `store-verified` events
 * without requiring a separate round-trip to resolve the session user.
 */
export async function getStoresByUserIdAction() {
  return authGuard('GET_STORES_BY_USER_ID', null, async (userId) => {
    const result = await getStoresByUserId({ userId });
    return { ...result, userId };
  });
}

// ---------------------------------------------------------------------------
// deleteStoreByIdAction
// ---------------------------------------------------------------------------

/** Deletes a store by ID after verifying ownership. */
export async function deleteStoreByIdAction(storeId: string) {
  // 1. Input validation
  if (!storeId) return { success: false, message: 'Missing required fields' };

  // 2. Auth + business logic
  return authGuard('DELETE_STORE_BY_ID', '/stores', (userId) => deleteStoreById({ storeId, userId }));
}

// ---------------------------------------------------------------------------
// editStoreByIdAction
// ---------------------------------------------------------------------------

/**
 * Updates name, config, and/or sync toggle for an existing store.
 *
 * The explicit `authGuard` generic is required here.
 * Without it, TypeScript infers `T` from the callback's return-type union and
 * narrows `fieldErrors` to `undefined` (the narrowest member), making
 * `Partial<T>.fieldErrors = undefined` — incompatible with the actual
 * `Partial<Record<...>>` value returned by `editStoreById` on validation failure.
 * Supplying `T` explicitly widens the inference and resolves the mismatch.
 */
export async function editStoreByIdAction(storeId: string, data: { name?: string; config?: Record<string, unknown>; isSyncEnabled?: boolean }) {
  // 1. Input validation
  const { name, config, isSyncEnabled } = data;
  if (!storeId || (!name && !config && isSyncEnabled === undefined)) {
    return { success: false, message: 'Missing required fields' };
  }

  // 2. Auth + business logic
  return authGuard<{ fieldErrors?: StoreFieldErrors }>('EDIT_STORE_BY_ID', '/stores', (userId) => editStoreById({ storeId, userId, ...data }));
}

// ---------------------------------------------------------------------------
// getStoreStatsAction
// ---------------------------------------------------------------------------

/**
 * Returns aggregated store statistics (per-platform counts, connected, synced)
 * for the authenticated user. Used by StoreHeader to populate the stat pills.
 */
export async function getStoreStatsAction() {
  return authGuard('GET_STORE_STATS', null, (userId) => getStoreStats({ userId }));
}
