// Supabase
import { createServerClient } from '@supabase/ssr';

// Next Js
import { NextResponse, type NextRequest } from 'next/server';

// Utils
import { getEnvVariables } from './utils';

export async function updateSession(request: NextRequest) {
  // 1. Prepare the response (we might need to modify headers)
  let response = NextResponse.next({ request: { headers: request.headers } });

  // 2. Get env variables
  const { supabaseUrl, supabaseKey } = getEnvVariables();

  // 2. Setup Supabase Client
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // If Supabase gives us a new token, we save it in the request AND response
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } }); // Update response
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // 3. Check the User (Refreshes token if needed)
  const { data } = await supabase.auth.getUser();
  const { user } = data;

  // 4. Protect Routes
  // If NO user and trying to go to a protected page -> Redirect to Login
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 5. Redirect Logged-In Users
  // If user IS logged in and tries to go to Login -> Redirect to Dashboard
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/products';
    return NextResponse.redirect(url);
  }

  return response;
}
