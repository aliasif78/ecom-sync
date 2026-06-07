// Next Js
import { NextResponse } from 'next/server';

// Supabase
import { createClient } from '@/lib/supabase/server';

// Database
import { connectDB } from '@/database/mongoose';
import User from '@/database/models/User';

// BE Functions
import { syncUserStatus } from '@/lib/users';

// Constants
import { VERIFIED } from '@/lib/globalConstants';

export async function GET(request: Request) {
  // URL
  // Will be something like: http://localhost:3000/login/google-callback?code=AbCdEf123456&next=/products
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/products';

  // If code exists
  if (code) {
    // Establish user session
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Success
    if (!error) {
      // 1. Get the user details
      const { data } = await supabase.auth.getUser();
      const { user } = data;

      // 2. User exists
      if (user) {
        // 3. Connect to the database
        await connectDB();

        // 4. Create or update user
        const { email, user_metadata } = user;
        const { full_name, avatar_url } = user_metadata;

        // 3. Check if user exists in Mongo
        const mongoUser = await User.findOne({ email });

        // --- SCENARIO A: RETURNING USER (Login) ---
        if (mongoUser) await syncUserStatus(mongoUser._id, user.id);
        // --- SCENARIO B: NEW USER (Sign Up) ---
        // Create the user directly with "Verified" status
        // We use "findOneAndUpdate" with "upsert: true"
        // Logic: Try to find the user. If found, update info. If NOT found, create them.
        else
          await User.findOneAndUpdate(
            { email }, // Search by email
            {
              email,
              name: full_name || email?.split('@')[0], // fallback to email prefix if name is missing
              supabaseId: user.id,
              status: VERIFIED, // Google users are always verified
              profilePicture: avatar_url,
              lastActive: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true } // upsert: update or insert
          );
      }

      // 5. Redirect to the next page
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 6. Error, redirect back to login
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
