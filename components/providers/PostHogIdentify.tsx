'use client';

// React
import { useEffect } from 'react';

// PostHog
import posthog from 'posthog-js';

// Supabase
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { USER_LOGGED_IN, USER_LOGGED_OUT, USER_REGISTERED } from '@/lib/posthog/constants';

export default function PostHogIdentify({ user }: { user: User | null }) {
  const supabase = createClient();

  // ⚡️ EFFECT 1: Instant Identity Hydration (Driven by Server Prop)
  // This ensures that if they hard-refresh, PostHog knows who they are instantly.
  useEffect(() => {
    if (user) {
      // 🆔 Link the anonymous session to the real Supabase User
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name,
        last_login: new Date().toISOString(),
      });
    }

    // 🧹 If no user (logged out), reset PostHog so the next person doesn't track events to the previous user's profile.
    else posthog.reset();
  }, [user]);

  // 🎯 EFFECT 2: Precise Action Tracking (Driven by Client Listener)
  // This ONLY fires when the user actually performs an auth action.
  useEffect(() => {
    // We only care about explicit actions here, not initial page loads
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // ⏱️ The Time Hack: Was this account created in the last 15 seconds?
        const accountAgeMs = Date.now() - new Date(session.user.created_at).getTime();
        const isNewSignup = accountAgeMs < 15000;

        // It's a brand new account!
        if (isNewSignup) posthog.capture(USER_REGISTERED, { email_domain: session.user.email?.split('@')[1], provider: session.user.app_metadata.provider || 'email' });
        // It's an existing user coming back
        else posthog.capture(USER_LOGGED_IN, { provider: session.user.app_metadata.provider || 'email' });
      }

      if (event === 'SIGNED_OUT') posthog.capture(USER_LOGGED_OUT);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase.auth]);

  return null;
}
