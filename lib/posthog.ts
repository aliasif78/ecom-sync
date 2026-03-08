import { PostHog } from 'posthog-node';

export default function PostHogClient() {
  const posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1, // Send events immediately in serverless environments
    flushInterval: 0,
  });

  return posthogClient;
}
