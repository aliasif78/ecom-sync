// React
import { useState } from 'react';

// Shadcn
import { toast } from 'sonner';

// Server Actions
import { syncProductStock } from '@/actions/inventory';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalSelect, ModalFooter } from './Atoms';

// Types
import { ProductRow } from '@/types';

// Constants
import { MANUAL } from '@/lib/globalConstants';

export default function SyncStockModal({ isOpen, onClose, product }: { isOpen: boolean; onClose: () => void; product: ProductRow }) {
  // States
  // ✅ Initialize state directly from the prop
  // Because we add a 'key' in the parent, this line runs fresh every time a new product is selected.
  const [newStock, setNewStock] = useState(product?.stock.toString() || '');
  const [reason, setReason] = useState('Manual Adjustment');
  const [isLoading, setIsLoading] = useState(false);

  // Functions
  const handleSync = async () => {
    // Safety Checks
    if (!newStock || Number(newStock) < 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    if (Number(newStock) === product.stock) {
      toast.error('New stock is the same as current stock');
      return;
    }

    // Initiate process
    setIsLoading(true);

    try {
      const res = await syncProductStock(product._id, Number(newStock), reason, MANUAL);

      // Error
      if (!res.success || res.error) {
        console.error(res.error);
        toast.error(res.error || 'Failed to sync stock');
        return;
      }

      // Success
      toast.success('Stock synced successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to sync stock');
      console.error('Error syncing stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader
        title="Update Inventory"
        description={
          <span>
            Adjust stock for <span className="font-semibold text-indigo-400">{product.name}</span>
          </span>
        }
        onClose={onClose}
      />

      <div className="space-y-4">
        <ModalInput label="New Quantity" type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} suffix="units" />

        <ModalSelect
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: 'Manual Adjustment', label: 'Manual Adjustment' },
            { value: 'Stock Audit', label: 'Stock Audit' },
            { value: 'Damaged Goods', label: 'Damaged Goods' },
          ]}
        />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSync} isLoading={isLoading} confirmText="Confirm Sync" />
    </ModalShell>
  );
}
