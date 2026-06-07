// Inngest
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// Functions
import { syncStockToStores, forceSyncAllStores, verifyStoreConnection } from '@/lib/inngest/functions/syncs';
import { smartStockoutCheck } from '@/lib/inngest/functions/smartStockout';

// Register all Inngest functions with the serve handler.
// Every function exported from the syncs / smartStockout modules must be
// listed here — Inngest only processes events for functions it knows about.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncStockToStores,
    forceSyncAllStores,
    verifyStoreConnection, // ← handles 'store/store.added' → validates credentials → flips isConnected
    smartStockoutCheck,
  ],
});
