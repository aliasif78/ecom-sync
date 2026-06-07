export const dynamic = 'force-dynamic';

// React
import { Suspense } from 'react';

// Components
import StoreHeader from '@/components/stores/StoreHeader';
import StoreListWrapper from '@/components/stores/StoreListWrapper';
import { StoreTableSkeleton } from '@/components/stores/StoreTableSkeleton';

// Server Actions
import { getStoreStatsAction } from '@/actions/stores';

// Types
import { StoreStats } from '@/types';

// ---------------------------------------------------------------------------
// Zero-state fallback — shown while stats are unavailable (auth failure, etc.)
// ---------------------------------------------------------------------------

/** All-zeros fallback so StoreHeader always has a valid shape to render. */
const EMPTY_STATS: StoreStats = {
  shopify: 0,
  amazon: 0,
  woocommerce: 0,
  connected: 0,
  synced: 0,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Stores dashboard page (server component).
 *
 * Architecture:
 *  - `getStoreStatsAction` is awaited at the page level.  It runs a single
 *    MongoDB aggregation, so the overhead is minimal.
 *  - The computed `stats` are threaded into `StoreHeader` (client component)
 *    as a serialisable prop — no client-side fetching needed.
 *  - The heavy table data (`StoreListWrapper`) is still streamed behind a
 *    `Suspense` boundary so the page renders immediately with a skeleton.
 */
const Page = async () => {
  // Fetch aggregated stats server-side.
  // If the action fails (e.g. the user is somehow unauthenticated at this
  // point) we fall back to all-zeros so the page doesn't crash.
  const { success, stats } = await getStoreStatsAction();
  const resolvedStats: StoreStats = success && stats ? stats : EMPTY_STATS;

  return (
    <div className="min-h-screen bg-slate-950 p-8 pt-30 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Header + dynamic stat pills — renders immediately */}
        <StoreHeader stats={resolvedStats} />

        {/*
         * Table — deferred behind Suspense.
         * The skeleton shows until StoreListWrapper resolves its own
         * getStoresByUserIdAction call.
         */}
        <Suspense fallback={<StoreTableSkeleton />}>
          <StoreListWrapper />
        </Suspense>
      </div>
    </div>
  );
};

export default Page;
