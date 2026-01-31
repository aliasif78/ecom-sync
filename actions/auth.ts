// Types
import { LoginFormValues, SignUpFormValues } from '@/types';

// Database
import { connectDB } from '@/database/mongoose';
import User from '@/database/models/User';

// Supabase
import { createClient } from '@/lib/supabase/server';

export const login = async (formData: LoginFormValues) => {
  // 1. Destructure form data
  const { email, password } = formData;

  // 2. Are all fields provided?
  if (!email || !password) return { success: false, error: 'All fields are required' }; // Missing information

  try {
    // 3. Ask Supabase: "Is this password correct?"
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    // 4. Find the user by email
    await connectDB();
    const user = await User.findOne({ email });
    if (!user) return { success: false, error: 'User not found' };

    // 5. Authenticated successfully
    return { success: true, user: JSON.parse(JSON.stringify(user)) };
  } catch (error) {
    // Something went wrong
    console.error(error);
    return { success: false, error };
  }
};

export const signUp = async (formData: SignUpFormValues) => {
  // 1. Destructure form data
  const { name, email, password, confirmPassword, stores } = formData;

  // 2. Are all fields provided?
  if (!name || !email || !password || !confirmPassword || !stores) return { success: false, error: 'All fields are required' }; // Missing information

  // 3. Check if the passwords match
  if (password !== confirmPassword) return { success: false, error: 'Passwords do not match' }; // Passwords do not match

  try {
    // 4. Connect to the database
    await connectDB();

    // 5. Check if the user already exists
    const user = await User.findOne({ email });
    if (user) return { success: false, error: 'User already exists' }; // Duplicate

    // 6. Valid information, create the user in Supabase
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });

    // Something went wrong
    if (authError) return { success: false, error: authError.message };
    if (!authData.user) return { success: false, error: 'Failed to create account' };

    // 7. Create Profile in MongoDB (The Critical Link)
    // We use the UUID from Supabase (authData.user.id) as the 'supabaseId'
    const newUser = await User.create({ supabaseId: authData.user.id, name, email, shopify: { shopName: stores.shopify, accessToken: '' }, amazon: { shopName: stores.amazon, accessToken: '' }, woocommerce: { shopName: stores.woocommerce, accessToken: '' } });

    // 8. User created successfully
    return { success: true, user: JSON.parse(JSON.stringify(newUser)) };
  } catch (error) {
    // Something went wrong
    console.error(error);
    return { success: false, error };
  }
};
