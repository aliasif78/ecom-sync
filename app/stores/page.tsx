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
// Props
// ---------------------------------------------------------------------------

interface PageProps {
  // Next.js 15+/16 passes searchParams as a Promise — must be awaited before use.
  searchParams: Promise<{ page?: string }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Stores dashboard page (server component).
 *
 * Architecture:
 *  - `getStoreStatsAction` is awaited at the page level.  It runs a single
 *    MongoDB aggregation over the WHOLE collection, so the overhead is
 *    minimal and it's deliberately independent of pagination.
 *  - The computed `stats` are threaded into `StoreHeader` (client component)
 *    as a serialisable prop — no client-side fetching needed.
 *  - The heavy table data (`StoreListWrapper`) is still streamed behind a
 *    `Suspense` boundary so the page renders immediately with a skeleton.
 *  - Pagination: the URL's `page` param is a navigation hint only, never
 *    trusted as-is. It's parsed and clamped to >= 1 here; getStoresByUserId
 *    clamps it AGAIN independently server-side. Same defense-in-depth
 *    pattern as app/products/page.tsx.
 */
const Page = async ({ searchParams }: PageProps) => {
  // Fetch aggregated stats server-side.
  // If the action fails (e.g. the user is somehow unauthenticated at this
  // point) we fall back to all-zeros so the page doesn't crash.
  const { success, stats } = await getStoreStatsAction();
  const resolvedStats: StoreStats = success && stats ? stats : EMPTY_STATS;

  const resolvedSearchParams = await searchParams;
  const requestedPage = Number(resolvedSearchParams?.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;

  return (
    <div className="min-h-screen bg-slate-950 p-8 pt-30 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Header + dynamic stat pills — renders immediately */}
        <StoreHeader stats={resolvedStats} />

        {/*
         * Table — deferred behind Suspense.
         * The skeleton shows until StoreListWrapper resolves its own
         * getStoresByUserIdAction call.
         *
         * `key={page}` on StoreListWrapper forces a full remount of the
         * client tree beneath it (StoreTable included) on every page
         * change. Without this, StoreTable's `initiallyDisconnectedIds`
         * snapshot — a lazy useState initializer that only runs on first
         * mount — would keep referring to page 1's stores forever, and
         * stores loaded on page 2+ would incorrectly flash "Verifying…"
         * instead of "Disconnected". Remounting re-derives that snapshot
         * fresh from whichever stores are actually on the new page.
         */}
        <Suspense fallback={<StoreTableSkeleton />}>
          <StoreListWrapper key={page} page={page} />
        </Suspense>
      </div>
    </div>
  );
};

export default Page;
