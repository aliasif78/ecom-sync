// Next Js
import Link from 'next/link';

// Types
import { ProductsPaginationInfo } from '@/lib/products';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  pagination: ProductsPaginationInfo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Server-rendered pager for the /products table.
 *
 * Deliberately NOT a client component with local page state. Every control
 * here is a real `?page=N` URL. Clicking one triggers a normal Next.js
 * navigation, which re-runs app/products/page.tsx on the server with the
 * new `page` search param, which re-queries MongoDB with a fresh
 * skip/limit via getProducts. Pagination is enforced by the query itself —
 * the client never holds more than one page's worth of products, and
 * there's no client-side array to page through even if someone tried.
 */
const ProductPagination = ({ pagination }: Props) => {
  const { page, limit, totalCount, totalPages } = pagination;

  // Nothing to paginate — hide entirely rather than showing a useless
  // "Page 1 of 1" bar.
  if (totalCount === 0) return null;

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const firstItem = (page - 1) * limit + 1;
  const lastItem = Math.min(page * limit, totalCount);

  const hrefForPage = (p: number) => `/products?page=${p}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 px-8 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">
        Showing <span className="font-semibold text-slate-200">{firstItem}</span>–<span className="font-semibold text-slate-200">{lastItem}</span> of <span className="font-semibold text-slate-200">{totalCount}</span> products
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

export default ProductPagination;
