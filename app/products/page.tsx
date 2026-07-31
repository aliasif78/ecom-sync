export const dynamic = 'force-dynamic';

// Server Component

// API
import { getProducts } from '@/lib/products';
import { getCurrentUser } from '@/lib/users';
import { getOpenStockoutRiskProductIds } from '@/lib/alerts/index';

// Components
import ProductHeader from '@/components/products/ProductHeader';
import ProductTable from '@/components/products/ProductTable';
import ErrorMessage from '@/components/shared/ErrorMessage';
import RedisStressTest from '@/components/shared/RedisStressTest';
import Copilot from '@/components/shared/Copilot';

interface PageProps {
  // Next.js 15+/16 passes searchParams as a Promise — must be awaited
  // before use, can't be destructured synchronously like in older versions.
  searchParams: Promise<{ page?: string }>;
}

const Page = async ({ searchParams }: PageProps) => {
  // Auth guard — verified server-side here, not assumed from the caller.
  // (See prior fix: this page previously called getProducts with a
  // potentially-undefined userId with no auth check of its own.)
  const { success: authSuccess, user } = await getCurrentUser();

  if (!authSuccess || !user) {
    return <ErrorMessage message="You must be logged in to view products." />;
  }

  const userId = user._id.toString();

  // ── Pagination ────────────────────────────────────────────────────────
  // The URL's `page` param is a navigation hint only — never trusted as-is.
  // Parsed and clamped to >= 1 here; getProducts clamps it AGAIN
  // independently against MAX_PRODUCTS_PAGE_SIZE server-side. A hand-edited
  // URL (?page=-5, ?page=abc, ?page=999999) can't force an invalid or
  // oversized query against MongoDB — it just falls back to page 1 or
  // returns an empty (but valid) page.
  const resolvedSearchParams = await searchParams;
  const requestedPage = Number(resolvedSearchParams?.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;

  const { products, success, message, pagination, stats } = await getProducts(userId, { page });

  if (!success) {
    console.error(`🚩 Page Load Error: ${message}`);
    return <ErrorMessage message={message} />;
  }

  // Stockout-risk product IDs, from Feature 2's Alert collection — replaces
  // the old product.stockoutRisk field as the "Stockout Risk" badge's data
  // source (see ProductTable.tsx). `user` is guaranteed non-null past the
  // guard above, so this no longer needs a defensive `user?._id ? ... : []`.
  const stockoutRiskProductIds = await getOpenStockoutRiskProductIds(userId);

  // Constants
  const isSyncing = user.isSyncing || [];

  return (
    // Page Container - Dark theme to match the table
    <div className="min-h-screen bg-slate-950 p-8 pt-26 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Redis Distributed Lock Button */}
        <RedisStressTest />

        {/* AI Copilot */}
        <Copilot />

        {/* Page Header Area — totalStock/lowStockCount now come from a
            whole-catalog Mongo aggregation inside getProducts, NOT a
            reduce/filter over `products` — `products` is only the current
            page's slice and would otherwise silently report page-scoped
            numbers as if they were catalog-wide totals. */}
        <ProductHeader totalStock={stats.totalStock} lowStockCount={stats.lowStockCount} />

        {/* The Main Data Table — BE-paginated: `products` is exactly one
            page's worth of documents fetched with skip/limit in MongoDB,
            not sliced client-side from a full fetch. Pager controls live
            inside ProductTable and navigate via real `?page=N` URLs. */}
        <ProductTable products={products} isSyncing={isSyncing} stockoutRiskProductIds={stockoutRiskProductIds} pagination={pagination} />
      </div>
    </div>
  );
};

export default Page;
