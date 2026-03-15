// Next JS
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// BE Functions
import { getCurrentUser } from './users';

// PostHog
import PostHogClient from './posthog';
import { CHAOS_MODE_ERROR } from './posthog/constants';

// --- Types ---
// 🟢 NEW: Flexible. Allows any keys you want.
// We use 'Partial<T>' so that when errors happen, we don't need to return empty data.
export type ActionResponse<T = unknown> = { success: boolean; message: string } & Partial<T>;

/**
 * A standardized wrapper for all Server Actions.
 * Handles Authentication, Error Logging, and Revalidation.
 */
export async function authGuard<T>(
  tag: string, // e.g. "ADD_STORE"
  path: string | null, // e.g. "/stores" (pass null to skip revalidate)
  fn: (userId: string) => Promise<ActionResponse<T>> // The actual business logic
): Promise<ActionResponse<T>> {
  try {
    // 1. Centralized Auth
    const { success, user, message } = await getCurrentUser();

    if (!success || !user) {
      console.error(`🚩 ${tag}_AUTH_ERROR: User not found`);
      return { success: false, message: message || 'Unauthorized' } as ActionResponse<T>;
    }

    // 2. Chaos Mode Check
    const cookieStore = await cookies();
    const isChaosActive = cookieStore.get('chaos_mode')?.value === 'true';

    // 3. Random Failure Simulation
    if (isChaosActive) {
      // A) Post Hog - Track the Chaos Strike globally using your Tag
      const ph = PostHogClient();
      ph.capture({ distinctId: user._id.toString(), event: CHAOS_MODE_ERROR, properties: { chaos_mode: true, tag } });
      await ph.shutdown();

      // B) Random Failure Simulation
      const rand = Math.random();

      // I) The Hard Crash (HTTP 500)
      if (rand < 0.99) {
        console.error(`🚩 ${tag}_CHAOS_MODE: Simulated hard crash`);
        return { success: false, message: '🐒 Simulated hard crash Error' } as ActionResponse<T>;
      }

      // II) The Tarpit (Latency)
      else {
        console.error(`🚩 ${tag}_CHAOS_MODE: Simulated latency`);
        await new Promise((resolve) => setTimeout(resolve, 6000));
        return { success: false, message: '🐒 Simulated latency Error' } as ActionResponse<T>;
      }
    }

    // 4. Execute Business Logic (Inject User ID)
    const result = await fn(user._id.toString());

    // 5. Handle Business Logic Failure
    if (!result.success) {
      console.error(`🚩 ${tag}_LOGIC_ERROR: ${result.message}`);
      return result; // Return the specific error from the backend function
    }

    // 6. Centralized Revalidation
    if (path) revalidatePath(path);

    // 7. Success response
    return result;
  } catch (error) {
    // Catch Unexpected Crashes (e.g. DB connection died)
    console.error(`🚩 ${tag}_CRITICAL_ERROR:`, error);
    return { success: false, message: `System Error: Failed to execute ${tag}` } as ActionResponse<T>;
  }
}
