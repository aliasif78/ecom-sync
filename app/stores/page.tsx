// Components
import StoreHeader from '@/components/stores/StoreHeader';
import StoreTable from '@/components/stores/StoreTable';

// Server Actions
import { getStoresByUserIdAction } from '@/actions/stores';

const Page = async () => {
  // Run the server action
  const { stores } = await getStoresByUserIdAction();

  return (
    // Page Container - Dark theme to match the table
    <div className="min-h-screen bg-slate-950 p-8 pt-30 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Page Header Area */}
        <StoreHeader />

        {/* The Main Data Table */}
        <StoreTable stores={stores} />
      </div>
    </div>
  );
};

export default Page;
