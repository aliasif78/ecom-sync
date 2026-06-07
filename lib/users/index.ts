// Database
import { connectDB } from '@/database/mongoose';
import User from '@/database/models/User';
import Product from '@/database/models/Product';

// Supabase
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';

// Constants
import { VERIFIED, NOT_VERIFIED, MUTEX_ALL } from '../globalConstants';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns the currently authenticated Supabase user, or `null` if there is
 * no active session.
 *
 * Design note: this function intentionally returns `null` rather than
 * throwing.  A missing session is an *expected* outcome (e.g. post-logout),
 * not an exceptional error.  Throwing here caused Next.js 16 + Turbopack to
 * forward the error to the browser DevTools as a red `console.error`, even
 * though the middleware had already issued a redirect.
 */
const getCurrentSbUser = async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
};

/**
 * Asserts that the current request is authenticated AND that the caller has
 * sufficient privileges (self or admin).
 *
 * @throws {Error} when the session is missing or permissions are insufficient.
 */
const authorizeRequest = async (targetSupabaseId?: string) => {
  const currentUser = await getCurrentSbUser();
  if (!currentUser) throw new Error('Unauthorized: No session');

  const isSelf = targetSupabaseId ? currentUser.id === targetSupabaseId : false;
  const isAdmin = currentUser.app_metadata?.role === 'admin';

  if (!isSelf && !isAdmin) throw new Error('Unauthorized: Insufficient permissions');

  return { isAdmin, isSelf };
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Returns all users. Admin-only.
 */
export const getAllUsers = async () => {
  try {
    const { isAdmin } = await authorizeRequest();
    if (!isAdmin) throw new Error('Unauthorized: Insufficient permissions');

    await connectDB();

    const users = await User.find({}).select('name email role createdAt status lastActive createdAt profilePicture').sort({ createdAt: -1 }).lean();

    const sanitizedUsers = users.map((user) => ({
      ...user,
      _id: user._id.toString(),
      lastActive: user.lastActive?.toISOString() || 'N/A',
      createdAt: user.createdAt?.toISOString() || 'N/A',
    }));

    return { success: true, users: sanitizedUsers };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to get users', users: [] };
  }
};

/**
 * Updates a user's name, role, and/or status in both Supabase and MongoDB.
 */
export const updateUserById = async (id: string, data: { role?: string; name?: string; status?: string }) => {
  const { name, role, status } = data;
  if (!id || (!name && !role && !status)) return { success: false, error: 'No data provided' };

  try {
    await connectDB();

    const user = await User.findById(id);
    if (!user) return { success: false, message: 'User not found' };

    const { isAdmin } = await authorizeRequest(user.supabaseId);
    if (role && !isAdmin) return { success: false, message: 'Unauthorized' };

    const supabaseUpdates: {
      user_metadata?: { full_name?: string };
      app_metadata?: { role?: string };
      email_confirmed_at?: string | null;
    } = {};

    if (name) supabaseUpdates.user_metadata = { full_name: name };
    if (role) supabaseUpdates.app_metadata = { role };
    if (status) supabaseUpdates.email_confirmed_at = status === VERIFIED ? new Date().toISOString() : null;

    const supabaseAdmin = createAdminClient();
    const { error: supabaseError } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, supabaseUpdates);

    if (supabaseError) {
      console.error(supabaseError);
      return { success: false, message: 'Failed to update user' };
    }

    const mongoUpdates: { name?: string; role?: string; status?: string } = {};
    if (name) mongoUpdates.name = name;
    if (role) mongoUpdates.role = role;
    if (status) mongoUpdates.status = status;

    const updatedUser = await User.findByIdAndUpdate(id, mongoUpdates, { new: true });
    if (!updatedUser) return { success: false, message: 'Failed to update user' };

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to update user' };
  }
};

/**
 * Hard-deletes a user from both Supabase and MongoDB.
 */
export const deleteUserById = async (id: string) => {
  if (!id) return { success: false, error: 'No id provided' };

  try {
    await connectDB();

    const user = await User.findById(id);
    if (!user) return { success: false, message: 'User not found' };

    await authorizeRequest(user.supabaseId);

    const supabaseAdmin = createAdminClient();
    const { error: supabaseError } = await supabaseAdmin.auth.admin.deleteUser(user.supabaseId);

    if (supabaseError) {
      console.error('Supabase Delete Failed:', supabaseError);
      return { success: false, message: 'Failed to delete user' };
    }

    const deletedUser = await User.findByIdAndDelete(id);
    return { success: true, user: deletedUser };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to delete user' };
  }
};

/**
 * Syncs the user's verification status and last-active timestamp from
 * Supabase into MongoDB.  Called after login.
 */
export const syncUserStatus = async (mongoId: string, supabaseId: string) => {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.getUserById(supabaseId);
  const { user } = data;
  if (error || !user) return;

  const realStatus = user.email_confirmed_at ? VERIFIED : NOT_VERIFIED;
  const realLastActive = user.last_sign_in_at ? new Date(user.last_sign_in_at) : new Date();

  await User.findByIdAndUpdate(mongoId, { status: realStatus, lastActive: realLastActive });
  return realStatus;
};

/**
 * Returns the currently authenticated user from MongoDB.
 *
 * Returns `{ success: false }` — without logging — when there is no active
 * session.  A missing session is an expected state (e.g. immediately after
 * logout), not a system error, so we must not emit `console.error` here.
 * True system faults (DB down, etc.) still log at the `error` level.
 */
export const getCurrentUser = async () => {
  try {
    await connectDB();

    // `getCurrentSbUser` now returns null instead of throwing on no-session.
    const supabaseUser = await getCurrentSbUser();

    if (!supabaseUser) {
      // Expected path after logout — silent, no console noise.
      return { success: false, message: 'No active session' };
    }

    const user = await User.findOne({ supabaseId: supabaseUser.id });
    if (!user) return { success: false, message: 'User not found in database' };

    return { success: true, user };
  } catch (error) {
    // Only true unexpected faults reach here (e.g. DB connection failure).
    console.error('🚩 GET_CURRENT_USER_ERROR:', error);
    return { success: false, message: 'Failed to get current user' };
  }
};

/**
 * Adds one or more SKUs to the user's `isSyncing` mutex array.
 * Pass `MUTEX_ALL` to lock every product belonging to the user.
 */
export const addSyncMutex = async (userId: string, lockId: string) => {
  await connectDB();

  if (lockId !== MUTEX_ALL) {
    return await User.findByIdAndUpdate(userId, { $addToSet: { isSyncing: lockId } }, { new: true });
  }

  // Lock all products for this user
  const products = await Product.find({ userId }).select('sku');
  if (!products.length) return;

  const productSKUs = products.map((product) => product.sku);
  return await User.findByIdAndUpdate(userId, { $addToSet: { isSyncing: { $each: productSKUs } } }, { new: true });
};

/**
 * Removes a single SKU from the user's `isSyncing` mutex array.
 */
export const removeSyncMutex = async (userId: string, unlockId: string) => {
  await connectDB();
  return await User.findByIdAndUpdate(userId, { $pull: { isSyncing: unlockId } }, { new: true });
};
