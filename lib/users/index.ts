// Database
import User from '@/database/models/User';
import { connectDB } from '@/database/mongoose';

// Supabase
import { createAdminClient } from '../supabase/admin'; // For executing high-privilege commands
import { createClient } from '../supabase/server'; // For checking WHO is making the request

// Constants
import { VERIFIED, NOT_VERIFIED } from '../globalConstants';

// Helpers
const getCurrentSbUser = async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const currentUser = data?.user;

  if (!currentUser) throw new Error('Unauthorized: No session');
  return currentUser;
};

const authorizeRequest = async (targetSupabaseId?: string) => {
  // Get the current user
  const currentUser = await getCurrentSbUser();

  // 2. Check if the user is the one making the request or an admin
  const isSelf = targetSupabaseId ? currentUser.id === targetSupabaseId : false;
  const isAdmin = currentUser.app_metadata?.role === 'admin';

  // 3. The Rule: You must be the user themselves OR an admin
  if (!isSelf && !isAdmin) throw new Error('Unauthorized: Insufficient permissions');

  // 4. Return the authorization result
  return { isAdmin, isSelf };
};

// Exports
export const getAllUsers = async () => {
  try {
    // 1. Only authorize the admin for this
    const { isAdmin } = await authorizeRequest();
    if (!isAdmin) throw new Error('Unauthorized: Insufficient permissions');

    // 2. Connect to the database
    await connectDB();

    // 3. Get all users
    const users = await User.find({})
      .select('name email role createdAt status lastActive createdAt profilePicture') // 👈 ONLY fetch what you need
      .sort({ createdAt: -1 }) // Newest users first
      .lean(); // 👈 CRITICAL: Converts to plain JSON, prevents Next.js serialization error

    // 4. Serialization Fix (ObjectId to String)
    // .lean() leaves _id as new ObjectId("..."), which Next.js also hates.
    // We map over it to convert _id to string.
    const sanitizedUsers = users.map((user) => ({
      ...user,
      _id: user._id.toString(),
      // If you have Date objects, they usually pass fine, but sometimes safer to .toISOString() them if you see warnings.
      lastActive: user.lastActive?.toISOString() || 'N/A',
      createdAt: user.createdAt?.toISOString() || 'N/A',
    }));

    // 5. Return the users
    return { success: true, users: sanitizedUsers };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to get users', users: [] };
  }
};

export const updateUserById = async (id: string, data: { role?: string; name?: string }) => {
  // Safety Check
  const { name, role } = data;
  if (!id || (!name && !role)) return { success: false, error: 'No data provided' };

  try {
    // 1. Connect to the database
    await connectDB();

    // 2. Get the user
    const user = await User.findById(id);
    if (!user) return { success: false, message: 'User not found' };

    // 3. Check authorization
    const { isAdmin } = await authorizeRequest(user.supabaseId);
    if (role && !isAdmin) return { success: false, message: 'Unauthorized' }; // Only admin can change roles

    // 4. Build the user metadata for supabase
    const supabaseUpdates: { user_metadata?: { full_name?: string }; app_metadata?: { role?: string } } = {};
    if (name) supabaseUpdates.user_metadata = { full_name: name };
    if (role) supabaseUpdates.app_metadata = { role };

    // 5. Update in Supabase
    const supabaseAdmin = createAdminClient();
    const { error: supabaseError } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, supabaseUpdates);

    if (supabaseError) {
      console.error(supabaseError);
      return { success: false, message: 'Failed to update user' };
    }

    // 6. Build the update object for the Mongo DB
    const mongoUpdates: { name?: string; role?: string } = {};
    if (name) mongoUpdates.name = name;
    if (role) mongoUpdates.role = role;

    // 7. Update in the Mongo DB
    const updatedUser = await User.findByIdAndUpdate(id, mongoUpdates, { new: true });
    if (!updatedUser) return { success: false, message: 'Failed to update user' };

    // 8. Return the updated user
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to update user' };
  }
};

export const deleteUserById = async (id: string) => {
  // Safety Check
  if (!id) return { success: false, error: 'No id provided' };

  try {
    // 1. Connect to the database
    await connectDB();

    // 2. Get the user
    const user = await User.findById(id);
    if (!user) return { success: false, message: 'User not found' };

    // 3. Check authorization
    await authorizeRequest(user.supabaseId);

    // 4. Delete on Supabase
    const supabaseAdmin = createAdminClient();
    const { error: supabaseError } = await supabaseAdmin.auth.admin.deleteUser(user.supabaseId);

    if (supabaseError) {
      console.error('Supabase Delete Failed:', supabaseError);
      return { success: false, message: 'Failed to delete user' };
    }

    // 5. Delete on Mongo DB
    const deletedUser = await User.findByIdAndDelete(id);

    // 6. Return the deleted user
    return { success: true, user: deletedUser };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to delete user' };
  }
};

export const syncUserStatus = async (mongoId: string, supabaseId: string) => {
  const supabase = createAdminClient();

  // 1. Ask Supabase for the TRUTH
  const { data, error } = await supabase.auth.admin.getUserById(supabaseId);
  const { user } = data;
  if (error || !user) return;

  // 2. Determine Status
  const realStatus = user.email_confirmed_at ? VERIFIED : NOT_VERIFIED;
  const realLastActive = user.last_sign_in_at ? new Date(user.last_sign_in_at) : new Date();

  // 3. Update Mongo blindly (it's fast/cheap)
  await User.findByIdAndUpdate(mongoId, { status: realStatus, lastActive: realLastActive });
  return realStatus;
};
