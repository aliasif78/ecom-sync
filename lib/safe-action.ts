// Next JS
import { revalidatePath } from 'next/cache';

// BE Functions
import { getCurrentUser } from './users';

// --- Types ---
type ActionResponse<T> = { success: boolean; message: string; data?: T };

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
      return { success: false, message: message || 'Unauthorized' };
    }

    // 2. Execute Business Logic (Inject User ID)
    const result = await fn(user._id.toString());

    // 3. Handle Business Logic Failure
    if (!result.success) {
      console.error(`🚩 ${tag}_LOGIC_ERROR: ${result.message}`);
      return result; // Return the specific error from the backend function
    }

    // 4. Centralized Revalidation (Optional)
    if (path) {
      revalidatePath(path);
    }

    return result;
  } catch (error) {
    // 5. Catch Unexpected Crashes (e.g. DB connection died)
    console.error(`🚩 ${tag}_CRITICAL_ERROR:`, error);
    return { success: false, message: `System Error: Failed to execute ${tag}` };
  }
}
