'use client';

// React
import { useState, useEffect } from 'react';

// Server Actions
import { syncProductStock } from '@/actions/inventory';

// Shacn
import { toast } from 'sonner';

// Constants
import { MANUAL } from '@/lib/globalConstants';

// Interfaces
interface Product {
  _id: string;
  name: string;
  sku: string;
  stock: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

const SyncStockModal = ({ isOpen, onClose, product }: Props) => {
  // States
  const [newStock, setNewStock] = useState<string>('');
  const [reason, setReason] = useState('Manual Adjustment');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when product changes
  useEffect(() => {
    if (isOpen && product) setNewStock(product.stock.toString());
  }, [product, isOpen]);

  // Conditional rendering
  if (!isOpen || !product) return null;

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
    // 1. Overlay (Backdrop)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
      {/* 2. Modal Content */}
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl transition-all duration-300">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Update Inventory</h2>
            <p className="mt-1 text-sm text-slate-400">
              Adjust stock level for <span className="font-semibold text-indigo-400">{product.name}</span>
            </p>
          </div>

          <button onClick={onClose} className="text-slate-500 transition-colors hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Status Badge */}
        <div className="mb-6 flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/50 p-4">
          <span className="text-sm text-slate-400">Current Stock</span>
          <span className="font-mono text-xl font-bold text-white">{product.stock} units</span>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          {/* New Stock Input */}
          <div>
            <label htmlFor="newStock" className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
              New Quantity
            </label>

            <div className="relative">
              <input type="number" id="newStock" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="block w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-12 pl-4 text-white placeholder-slate-600 transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="0" min={0} />

              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-sm text-slate-500">units</span>
              </div>
            </div>
          </div>

          {/* Reason Input (Important for Ledger!) */}
          <div>
            <label htmlFor="reason" className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Reason for Change
            </label>

            <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="block w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
              <option value="Manual Adjustment">Manual Adjustment</option>
              <option value="Stock Audit">Stock Audit</option>
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Return Restock">Return Restock</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700">
            Cancel
          </button>

          <button onClick={handleSync} disabled={isLoading} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </span>
            ) : (
              'Confirm Sync'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncStockModal;
