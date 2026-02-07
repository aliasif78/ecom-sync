// Server Component

// Components
import StoreHeader from '@/components/stores/StoreHeader';
import StoreTable from '@/components/stores/StoreTable';

// Types
import { StoreRow } from '@/types/index';

const Page = async () => {
  //  Dummy stores
  const stores: StoreRow[] = [
    { _id: '1', name: 'Store 1', platform: 'SHOPIFY', isConnected: true, isSyncEnabled: true, lastSyncAt: '2022-01-01' },
    { _id: '2', name: 'Store 2', platform: 'AMAZON', isConnected: false, isSyncEnabled: true, lastSyncAt: '2022-01-01' },
    { _id: '3', name: 'Store 3', platform: 'WOOCOMMERCE', isConnected: true, isSyncEnabled: false, lastSyncAt: '2022-01-01' },
  ];

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
