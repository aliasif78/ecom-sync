// Components
import StoreHeader from '@/components/stores/StoreHeader';
import StoreTable from '@/components/stores/StoreTable';
import ErrorMessage from '@/components/shared/ErrorMessage';

// Server Actions
import { getStoresByUserIdAction } from '@/actions/stores';

const Page = async () => {
  // Run the server action
  const { stores, success, message } = await getStoresByUserIdAction();

  if (!success) {
    console.error(`🚩 Page Load Error: ${message}`);
    return <ErrorMessage message={message} />;
  }

  return (
    // Page Container - Dark theme to match the table
    <div className="min-h-screen bg-slate-950 p-8 pt-30 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Page Header Area */}
        <StoreHeader />

        {/* The Main Data Table */}
        <StoreTable stores={stores || []} />
      </div>
    </div>
  );
};

export default Page;
