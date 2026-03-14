'use client';

// React
import { useEffect } from 'react';

// PostHog
import { register } from '@/instrumentation-client';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Registering posthog client
  useEffect(() => register(), []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
