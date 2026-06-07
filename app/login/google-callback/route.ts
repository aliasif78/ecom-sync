/**
 * @fileoverview Google OAuth Callback — Server-side Route Handler
 *
 * WHY A ROUTE HANDLER INSTEAD OF A PAGE:
 *
 * The previous implementation was a client-side page that called
 * `supabase.auth.exchangeCodeForSession` inside a `useEffect`, then used
 * `router.push('/')` to navigate home.
 *
 * That approach has two fatal flaws in Next.js App Router:
 *
 *  1. RSC stale-cache bug — `router.push` is a *client-side* navigation.
 *     The root `layout.tsx` is a Server Component that fetched `user = null`
 *     during the *initial* render of `/login/google-callback` (before the code
 *     was exchanged). A client-side nav does not re-run root Server Components,
 *     so the Navbar never sees the new session — it stays on "Get Started".
 *
 *  2. OAuth users wrongly hit the email-verification screen — Supabase's
 *     production tier can return `email_confirmed_at = null` in the immediate
 *     PKCE exchange response for OAuth users, even though Google pre-verifies
 *     every address. Any code-path that gates on that field for OAuth sessions
 *     will incorrectly show the "Check your inbox" screen.
 *
 * This Route Handler fixes both:
 *
 *  - The code is exchanged **server-side**, and the resulting session cookies
 *    are written directly onto the `302` redirect response. When the browser
 *    follows the redirect to `/products`, the root layout runs fresh on the
 *    server with a live session — the Navbar renders the user immediately.
 *
 *  - There is no `email_confirmed_at` check here. OAuth users are always
 *    pre-verified by their identity provider; the email-verification flow only
 *    applies to the email+password sign-up path.
 */

// Next.js
import { type NextRequest, NextResponse } from 'next/server';

// Supabase
import { createServerClient } from '@supabase/ssr';

// Utils
import { getEnvVariables } from '@/lib/supabase/utils/clientUtils';

// ---------------------------------------------------------------------------
// GET /login/google-callback?code=<pkce_code>[&next=<path>]
// ---------------------------------------------------------------------------

/**
 * Handles the Supabase PKCE OAuth redirect for Google sign-in.
 *
 * Flow:
 *  1. Supabase redirects the browser here after Google authentication with a
 *     short-lived `?code=` query parameter (PKCE authorisation code).
 *  2. We create a Supabase server client whose cookie `setAll` writes directly
 *     onto the outgoing redirect `Response`, so the session is persisted in a
 *     single HTTP round-trip.
 *  3. `exchangeCodeForSession(code)` swaps the code for access + refresh
 *     tokens and calls `setAll` internally.
 *  4. We return the redirect response (to `/products` by default). Because
 *     this is a hard server redirect, the root layout re-runs on the server
 *     and sees the authenticated user — fixing the stale Navbar bug.
 *  5. On any error we bounce to `/login` with a descriptive query flag.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  // `next` lets the OAuth initiator specify a post-login destination.
  // Defaults to /products (the main authenticated landing page).
  const next = searchParams.get('next') ?? '/products';

  // No code present — the request is malformed or the user navigated here
  // directly. Bounce to login with a non-intrusive error flag.
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  // ── Build the redirect response first so we can attach cookies to it ──────
  //
  // Supabase's `setAll` callback is called synchronously during
  // `exchangeCodeForSession`. We need the response object to exist before
  // that call so the cookie writes land on the correct outgoing headers.
  const redirectUrl = new URL(next, request.url);
  const response = NextResponse.redirect(redirectUrl);

  const { supabaseUrl, supabaseKey } = getEnvVariables();

  // ── Create a server client that reads from the request and writes to the
  //    redirect response — the standard SSR pattern for Route Handlers ───────
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      /** Read existing cookies from the incoming request. */
      getAll: () => request.cookies.getAll(),

      /**
       * Write new / updated cookies onto the redirect response.
       * Called internally by `exchangeCodeForSession` with the session tokens.
       */
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // ── Exchange the PKCE authorisation code for a session ────────────────────
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[google-callback] exchangeCodeForSession error:', error.message);

    return NextResponse.redirect(new URL(`/login?error=auth_callback_failed`, request.url));
  }

  // ── Success — return the redirect with session cookies attached ───────────
  //
  // The browser will follow the 302, send the new cookies, and the root
  // layout Server Component will call `supabase.auth.getUser()` with a valid
  // session — the Navbar correctly renders the user's info on first load.
  return response;
}
