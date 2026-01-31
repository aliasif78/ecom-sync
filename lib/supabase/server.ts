// Next JS
import { cookies } from 'next/headers';

// Supabase
import { createServerClient } from '@supabase/ssr';

// Utils
import { getEnvVariables } from './utils';

// Will be used by server components
export const createClient = async () => {
  // Get cookie store
  const cookieStore = await cookies();

  // Get env variables
  const { supabaseUrl, supabaseKey } = getEnvVariables();

  // Create server client
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      // Supabase asks: "Do I have a user?"
      // It checks the incoming Request Cookies to find the token
      getAll: () => cookieStore.getAll(),

      // Supabase says: "This user just logged in (or refreshed their token). Please save this."
      // It writes the new token into the Response Cookies.
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component & they cannot write cookies.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
};
