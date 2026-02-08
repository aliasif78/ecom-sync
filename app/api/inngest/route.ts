// Inngest
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// Functions
import { helloWorld } from '@/lib/inngest/functions';

// Make the functions available to Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld],
});
