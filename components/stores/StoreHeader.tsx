'use client';

// Contenxts
// import { useStoreModals } from '@/contexts/StoreModalsProvider';

// Components
import PageHeader from '../shared/PageHeader';

const StoreHeader = () => {
  // Contexts
  // const { openAddModal } = useStoreModals();

  return (
    <PageHeader
      title="Store Management"
      description="Connect and configure your external e-commerce channels."
      actionLabel="Connect Store"
      onAction={() => {}}
      stats={[
        { label: 'Amazon', value: 1, colorClass: 'text-blue-400' },
        { label: 'Shopify', value: 1, colorClass: 'text-emerald-500' },
        { label: 'WooCommerce', value: 1, colorClass: 'text-purple-400' },
        { label: 'Synced', value: 3, colorClass: 'text-yellow-400' },
        { label: 'Connected', value: 3, colorClass: 'text-green-400' },

        // You can add more or leave it with just one
      ]}
    />
  );
};

export default StoreHeader;
