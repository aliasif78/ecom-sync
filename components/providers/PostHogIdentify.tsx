'use client';

// React
import { useEffect } from 'react';

// PostHog
import posthog from 'posthog-js';

// Supabase
import { User } from '@supabase/supabase-js';

export default function PostHogIdentify({ user }: { user: User | null }) {
  useEffect(() => {
    if (user) {
      // 🆔 Link the anonymous session to the real Supabase User
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name,
        last_login: new Date().toISOString(),
      });

      // Track a successful session start
      posthog.capture('user_session_authenticated');
    }

    // 🧹 If no user (logged out), reset PostHog so the next person doesn't track events to the previous user's profile.
    else posthog.reset();
  }, [user]);

  return null; // This component renders nothing, it just runs the logic
}
