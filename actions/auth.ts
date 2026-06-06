'use server';

// Types
import { LoginFormValues, SignUpFormValues } from '@/types';

// Database
import { connectDB } from '@/database/mongoose';
import User from '@/database/models/User';

// Supabase
import { createClient } from '@/lib/supabase/server';

// BE Functions
import { syncUserStatus } from '@/lib/users';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Substring present in Supabase's error message when a user attempts to
 * sign in before confirming their email address.  We match case-insensitively
 * so we're resilient to minor copy changes on Supabase's side.
 */
const EMAIL_NOT_CONFIRMED_SENTINEL = 'email not confirmed';

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export const login = async (formData: LoginFormValues) => {
  const { email, password } = formData;

  if (!email || !password) return { success: false, error: 'All fields are required' };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Surface "email not confirmed" as a distinct flag so the UI can
      // render the verification screen instead of a generic field error.
      if (error.message.toLowerCase().includes(EMAIL_NOT_CONFIRMED_SENTINEL)) {
        return { success: false, requiresEmailVerification: true, email } as const;
      }
      return { success: false, error: error.message };
    }

    await connectDB();
    const user = await User.findOne({ email });
    if (!user) return { success: false, error: 'User not found' };

    await syncUserStatus(user._id.toString(), user.supabaseId);

    return { success: true, user: JSON.parse(JSON.stringify(user)) };
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
};

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

export const signUp = async (formData: SignUpFormValues) => {
  const { name, email, password, confirmPassword, stores } = formData;

  if (!name || !email || !password || !confirmPassword || !stores) return { success: false, error: 'All fields are required' };

  if (password !== confirmPassword) return { success: false, error: 'Passwords do not match' };

  try {
    await connectDB();

    // Prevent duplicate accounts before touching Supabase.
    const existing = await User.findOne({ email });
    if (existing) return { success: false, error: 'User already exists' };

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (authError) return { success: false, error: authError.message };
    if (!authData.user) return { success: false, error: 'Failed to create account' };

    // Create the MongoDB profile immediately with NOT_VERIFIED status.
    // syncUserStatus will upgrade it to VERIFIED on the user's first login
    // after they click the confirmation link.
    await User.create({
      supabaseId: authData.user.id,
      name,
      email,
      shopify: { shopName: stores.shopify, accessToken: '' },
      amazon: { shopName: stores.amazon, accessToken: '' },
      woocommerce: { shopName: stores.woocommerce, accessToken: '' },
    });

    // When Supabase has email confirmation enabled (the default), the newly
    // created user has email_confirmed_at === null.  Signal this to the
    // client so it can render the "check your inbox" screen.
    if (!authData.user.email_confirmed_at) {
      return { success: true, requiresEmailVerification: true, email } as const;
    }

    // Edge-case: Supabase project has email confirmation disabled — the
    // account is immediately active, so proceed to the normal success path.
    return { success: true, user: JSON.parse(JSON.stringify(authData.user)) };
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
};

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export const logout = async () => {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
};

// ---------------------------------------------------------------------------
// resendVerificationEmail
// ---------------------------------------------------------------------------

/**
 * Resends the Supabase email confirmation link for an unverified account.
 *
 * The client enforces a 60-second cooldown between calls via a countdown
 * timer; Supabase itself also rate-limits resend requests on the platform
 * level as a secondary guard.
 *
 * @param email - The unverified account's email address.
 */
export const resendVerificationEmail = async (email: string) => {
  if (!email) return { success: false, error: 'Email is required' };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to resend verification email' };
  }
};

// ---------------------------------------------------------------------------
// Forgot Password
// ---------------------------------------------------------------------------

/**
 * Sends a 6-digit OTP to the given email address for password reset.
 * shouldCreateUser: false ensures only existing accounts can reset.
 */
export async function sendPasswordResetOtp(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Verifies the 6-digit OTP. If valid, Supabase creates a session. */
export async function verifyOtp(email: string, token: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Updates the user's password.  Must be called AFTER a successful verifyOtp.
 * Signs the user out immediately after to invalidate the OTP-granted session.
 */
export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  // Force a clean sign out so the temporary session doesn't persist.
  await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
}
