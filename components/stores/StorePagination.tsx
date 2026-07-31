// Next Js
import Link from 'next/link';

// Types
import { StoresPaginationInfo } from '@/lib/stores';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  pagination: StoresPaginationInfo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Server-rendered pager for the /stores table. Same pattern as
 * components/products/ProductPagination.tsx — plain `<Link href="?page=N">`
 * navigation, no client-side page state. Every click is a real server
 * round-trip through getStoresByUserId's skip/limit query.
 */
const StorePagination = ({ pagination }: Props) => {
  const { page, limit, totalCount, totalPages } = pagination;

  if (totalCount === 0) return null;

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const firstItem = (page - 1) * limit + 1;
  const lastItem = Math.min(page * limit, totalCount);

  const hrefForPage = (p: number) => `/stores?page=${p}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 px-8 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">
        Showing <span className="font-semibold text-slate-200">{firstItem}</span>–<span className="font-semibold text-slate-200">{lastItem}</span> of <span className="font-semibold text-slate-200">{totalCount}</span> stores
      </p>

      <div className="flex items-center gap-2">
        {canGoPrev ? (
          <Link href={hrefForPage(page - 1)} className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5">
            Previous
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-md border border-white/5 px-3 py-1.5 text-sm font-medium text-slate-600">Previous</span>
        )}

        <span className="px-2 text-sm text-slate-500">
          Page {page} of {totalPages}
        </span>

        {canGoNext ? (
          <Link href={hrefForPage(page + 1)} className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5">
            Next
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-md border border-white/5 px-3 py-1.5 text-sm font-medium text-slate-600">Next</span>
        )}
      </div>
    </div>
  );
};

export default StorePagination;
