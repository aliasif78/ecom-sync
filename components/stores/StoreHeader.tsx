'use client';

// Contexts
import { useStoreModals } from '@/contexts/StoreModalsProvider';

// Components
import PageHeader from '../shared/PageHeader';

// Types
import { StoreStats } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StoreHeaderProps {
  /** Live stats computed server-side from the user's store collection. */
  stats: StoreStats;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Page header for the Stores dashboard.
 *
 * Receives pre-computed `stats` from the parent server component so that
 * all metric values are real and dynamic — no hardcoding.
 *
 * The `openAddStoreModal` trigger still lives here because it requires the
 * StoreModalsContext, which is only available on the client.
 */
const StoreHeader = ({ stats }: StoreHeaderProps) => {
  const { openAddStoreModal } = useStoreModals();

  return (
    <PageHeader
      title="Store Management"
      description="Connect and configure your external e-commerce channels."
      actionLabel="Connect Store"
      onAction={openAddStoreModal}
      stats={[
        { label: 'Shopify', value: stats.shopify, colorClass: 'text-emerald-500' },
        { label: 'Amazon', value: stats.amazon, colorClass: 'text-blue-400' },
        { label: 'WooCommerce', value: stats.woocommerce, colorClass: 'text-purple-400' },
        { label: 'Connected', value: stats.connected, colorClass: 'text-green-400' },
        { label: 'Synced', value: stats.synced, colorClass: 'text-yellow-400' },
      ]}
    />
  );
};

export default StoreHeader;
