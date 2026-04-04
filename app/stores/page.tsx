export const dynamic = 'force-dynamic';

// Components
import StoreHeader from '@/components/stores/StoreHeader';
import StoreListWrapper from '@/components/stores/StoreListWrapper';
import { StoreTableSkeleton } from '@/components/stores/StoreTableSkeleton';

// Server Actions
import { Suspense } from 'react';

const Page = async () => {
  return (
    // Page Container - Dark theme to match the table
    <div className="min-h-screen bg-slate-950 p-8 pt-30 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Page Header Area */}
        <StoreHeader />

        {/* The Main Data Table */}
        {/* 🚀 This is the magic. 
          The page will load INSTANTLY. 
          It will show the fallback (skeleton) for 6 seconds.
          Then it will swap the skeleton for the actual data. */}
        <Suspense fallback={<StoreTableSkeleton />}>
          <StoreListWrapper />
        </Suspense>
      </div>
    </div>
  );
};

export default Page;
