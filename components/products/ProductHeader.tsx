'use client';

// Contenxts
import { useProductModals } from '@/contexts/ProductModalsProvider';

// Components
import PageHeader from '../shared/PageHeader';

// Interfaces
interface props {
  totalStock: number;
  lowStockCount: number;
}

const ProductHeader = ({ totalStock, lowStockCount }: props) => {
  // Contexts
  const { openAddModal } = useProductModals();

  return (
    <PageHeader
      title="Inventory Intelligence"
      description="Manage your global product catalog and synchronization status."
      actionLabel="Add Product"
      onAction={openAddModal}
      stats={[
        { label: 'Total Units', value: totalStock.toLocaleString(), colorClass: 'text-indigo-400' },
        { label: 'Low Stock', value: lowStockCount, colorClass: 'text-amber-400' },
      ]}
    />
  );
};

export default ProductHeader;
