// Next Js
import { NextResponse } from 'next/server';

// Supabase
import { createClient } from '@/lib/supabase/server';

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
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Error, redirect back to login
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
