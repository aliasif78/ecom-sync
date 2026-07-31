// Inngest
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// Functions
import { syncStockToStores, forceSyncAllStores, verifyStoreConnection } from '@/lib/inngest/functions/syncs';
import { anomalyAgent } from '@/lib/inngest/functions/anomalyAgent';

// Register all Inngest functions with the serve handler.
// Every function exported from these modules must be listed here — Inngest
// only processes events/crons for functions it knows about.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncStockToStores,
    forceSyncAllStores,
    verifyStoreConnection, // ← handles 'store/store.added' → validates credentials → flips isConnected
    anomalyAgent, // Replaces the deleted smartStockoutCheck — see Feature 2 / Phase 4-5
  ],
});
