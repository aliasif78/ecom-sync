// React
import { useState } from 'react';

// Dependencies
import { toast } from 'sonner';
import posthog from 'posthog-js';

// Server Actions
import { syncProductStock } from '@/actions/inventory';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalSelect, ModalFooter } from './Atoms';

// Types
import { ProductRow, InventoryReason } from '@/types';

// Constants
import { MANUAL } from '@/lib/globalConstants';
import { SYNC_PRODUCT_CLICKED } from '@/lib/posthog/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormErrors = Partial<Record<'newStock', string>>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the Sync Stock form client-side.
 * Returns a map of field → error message, or null if all fields are valid.
 */
function validate(newStock: string, currentStock: number): FormErrors | null {
  const errs: FormErrors = {};

  if (newStock === '' || Number(newStock) < 0) {
    errs.newStock = 'Please enter a valid stock quantity (0 or more).';
  } else if (Number(newStock) === currentStock) {
    errs.newStock = 'New stock must differ from the current stock level.';
  }

  return Object.keys(errs).length ? errs : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for adjusting a product's stock level across all connected stores.
 * All validation is done client-side first; server errors fall back to a toast.
 */
export default function SyncStockModal({ isOpen, onClose, product }: { isOpen: boolean; onClose: () => void; product: ProductRow }) {
  // ✅ Initialised from the prop; the parent adds `key={product._id}` so this
  //    runs fresh every time a different product is selected.
  const [newStock, setNewStock] = useState(product?.stock.toString() || '');
  const [reason, setReason] = useState<InventoryReason>(InventoryReason.MANUAL_ADJUSTMENT);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSync = async () => {
    // 1. Fire PostHog event immediately (before any validation)
    posthog.capture(SYNC_PRODUCT_CLICKED, { current_route: '/products' });

    // 2. Client-side validation
    const fieldErrors = validate(newStock, product.stock);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }

    // 3. Call server action
    setIsLoading(true);
    try {
      const res = await syncProductStock(product._id, Number(newStock), reason, MANUAL, description, product.sku);

      if (!res.success) {
        toast.error(res.message || 'Failed to sync stock.');
        return;
      }

      toast.info(`Syncing [${product.sku}]'s stock…`);
      onClose();
    } catch (error) {
      toast.error('Failed to sync stock.');
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
        <ModalInput
          label="New Quantity"
          type="number"
          min={0}
          value={newStock}
          onChange={(e) => {
            setNewStock(e.target.value);
            setErrors((prev) => ({ ...prev, newStock: undefined }));
          }}
          suffix="units"
          error={errors.newStock}
        />

        <ModalSelect
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as InventoryReason)}
          options={[
            { value: InventoryReason.MANUAL_ADJUSTMENT, label: 'Manual Adjustment' },
            { value: InventoryReason.RETURN_RESTOCK, label: 'Return Restock' },
            { value: InventoryReason.DAMAGED_GOODS, label: 'Damaged Goods' },
            { value: InventoryReason.THEFT_OR_LOSS, label: 'Theft or Loss' },
            { value: InventoryReason.RECEIVED_INVENTORY, label: 'Received Inventory' },
          ]}
        />

        <ModalInput label="Description (optional)" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSync} isLoading={isLoading} confirmText="Confirm Sync" />
    </ModalShell>
  );
}
