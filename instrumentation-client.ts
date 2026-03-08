import posthog from 'posthog-js';

export function register() {
  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // Recommended for privacy/security
      capture_pageview: true, // Auto-tracks every route change in Next.js
    });
  }
}
