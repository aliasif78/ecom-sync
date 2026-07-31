'use server';

// Auth wrapper — same pattern as actions/inventory.ts / actions/stores.ts
import { authGuard } from '@/lib/safe-action';

// Library functions
import { dismissAlert } from '@/lib/alerts';

/**
 * Dismisses an alert on behalf of the authenticated user. Ownership is
 * enforced inside `dismissAlert` itself (matches `userId`), not just here —
 * defense in depth, since `authGuard` only proves who's asking, not that
 * they own this specific alert.
 */
export async function dismissAlertAction(alertId: string) {
  return authGuard<{ success: boolean; message: string }>('DISMISS_ALERT', '/alerts', async (userId) => {
    return await dismissAlert(alertId, userId);
  });
}
