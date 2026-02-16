// Inngest
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// Functions
import { syncStockToStores } from '@/lib/inngest/functions';

// Make the functions available to Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncStockToStores],
});
