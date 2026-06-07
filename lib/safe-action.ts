// Next JS
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// BE Functions
import { getCurrentUser } from './users';

// PostHog
import PostHogClient from './posthog';
import { CHAOS_MODE_ERROR } from './posthog/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Standardized envelope returned by every Server Action.
 * Uses `Partial<T>` so failure paths don't need to supply empty data fields.
 */
export type ActionResponse<T = unknown> = { success: boolean; message: string } & Partial<T>;

// ---------------------------------------------------------------------------
// authGuard
// ---------------------------------------------------------------------------

/**
 * Centralised wrapper for all Server Actions.
 *
 * Responsibilities (in order):
 *  1. Authentication — rejects unauthenticated callers without noise
 *  2. Chaos Mode     — random failure injection for resilience testing
 *  3. Business Logic — delegates to the provided `fn` callback
 *  4. Revalidation   — invalidates the Next.js cache for the given path
 *
 * Log-level contract:
 *  - `console.warn`  → expected non-error outcomes (no session, logic failures)
 *  - `console.error` → true system faults (DB down, unhandled exception)
 *
 * This distinction matters in Next.js 16 + Turbopack: server `console.error`
 * calls are forwarded to the browser DevTools as red errors.  Auth failures
 * after logout are *expected* — they must not appear as red console errors.
 *
 * @param tag  - Identifies the action in logs, e.g. "ADD_STORE"
 * @param path - Next.js path to revalidate on success, or `null` to skip
 * @param fn   - Business logic receiving the authenticated userId
 */
export async function authGuard<T>(tag: string, path: string | null, fn: (userId: string) => Promise<ActionResponse<T>>): Promise<ActionResponse<T>> {
  try {
    // ── 1. Auth check ────────────────────────────────────────────────────────
    const { success, user, message } = await getCurrentUser();

    if (!success || !user) {
      // WARN not ERROR: this is an expected outcome whenever a logged-out user
      // triggers a server action (e.g. during post-logout page teardown).
      console.warn(`⚠️  ${tag}_NO_SESSION: ${message ?? 'Unauthenticated'}`);
      return { success: false, message: message || 'Unauthorized' } as ActionResponse<T>;
    }

    // ── 2. Chaos Mode ────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const isChaosActive = cookieStore.get('chaos_mode')?.value === 'true';

    if (isChaosActive) {
      // Track the chaos strike in PostHog
      const ph = PostHogClient();
      ph.capture({
        distinctId: user._id.toString(),
        event: CHAOS_MODE_ERROR,
        properties: { chaos_mode: true, tag },
      });
      await ph.shutdown();

      const rand = Math.random();

      // Hard crash (rare — ~1% of requests)
      if (rand > 0.99) {
        console.warn(`🐒 ${tag}_CHAOS_CRASH: Simulated hard crash`);
        return { success: false, message: '🐒 Simulated hard crash Error' } as ActionResponse<T>;
      }

      // Tarpit — artificial latency (remaining ~99%)
      console.warn(`🐒 ${tag}_CHAOS_LATENCY: Simulated 5 s delay`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return { success: false, message: '🐒 Simulated latency Error' } as ActionResponse<T>;
    }

    // ── 3. Business Logic ────────────────────────────────────────────────────
    const result = await fn(user._id.toString());

    if (!result.success) {
      // WARN not ERROR: a logic failure (e.g. "Store not found") is a handled
      // business outcome, not an unhandled exception.
      console.warn(`⚠️  ${tag}_LOGIC_FAILURE: ${result.message}`);
      return result;
    }

    // ── 4. Revalidation ──────────────────────────────────────────────────────
    if (path) revalidatePath(path);

    return result;
  } catch (error) {
    // TRUE system fault — DB connection died, unhandled exception, etc.
    // This warrants console.error because it is unexpected and actionable.
    console.error(`🚩 ${tag}_CRITICAL_ERROR:`, error);
    return {
      success: false,
      message: `System Error: Failed to execute ${tag}`,
    } as ActionResponse<T>;
  }
}
