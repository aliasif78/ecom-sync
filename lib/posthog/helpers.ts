// Client
import PostHogClient from '../posthog';

export const trackEvent = async (userId: string, event: string, properties: Record<string, unknown>) => {
  const ph = PostHogClient();
  ph.capture({ distinctId: userId, event, properties });
  await ph.shutdown(); // Always shutdown in Server Actions!
};
