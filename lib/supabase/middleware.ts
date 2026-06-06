// Supabase
import { createServerClient } from '@supabase/ssr';

// Next Js
import { NextResponse, type NextRequest } from 'next/server';

// Utils
import { getEnvVariables } from './utils/clientUtils';

// ---------------------------------------------------------------------------
// Protected-route registry
//
// Every pathname prefix listed here requires an active Supabase session.
// The middleware redirects unauthenticated visitors to /login BEFORE any
// server component runs, preventing the authGuard console.warn spam that
// appears in Next.js 16 + Turbopack dev mode.
// ---------------------------------------------------------------------------
const PROTECTED_PREFIXES = ['/products', '/stores', '/admin'] as const;

/**
 * Supabase session middleware.
 *
 * Called by `proxy.ts` (the Next.js 16 middleware entry-point) on every
 * matched request.  Responsibilities:
 *
 *  1. Bypass — skip auth entirely for Inngest webhooks
 *  2. Hydrate — create a Supabase SSR client that can read/refresh cookies
 *  3. Guard   — redirect unauthenticated visitors away from protected routes
 *  4. Bounce  — redirect authenticated visitors away from /login
 */
export async function updateSession(request: NextRequest) {
  // ── 1. Bypass Inngest webhook — no auth needed, save a round-trip ────────
  if (request.nextUrl.pathname.startsWith('/api/inngest')) {
    return NextResponse.next();
  }

  // ── 2. Hydrate Supabase SSR client ───────────────────────────────────────
  // `response` is rebuilt inside `setAll` whenever Supabase rotates the token
  // so the refreshed cookie is forwarded to both the request and the client.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const { supabaseUrl, supabaseKey } = getEnvVariables();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // ── 3. Resolve session (also refreshes an expired token if possible) ─────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── 4. Guard — unauthenticated user hitting a protected route ────────────
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Bounce — authenticated user hitting /login ─────────────────────────
  if (user && pathname.startsWith('/login')) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/products';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
