// React
import { useState, useEffect } from 'react';

// Dependencies
import { format } from 'date-fns';

// Components
import { ModalShell, ModalHeader } from './Atoms';

// Types
import { InventoryReason, ProductRow } from '@/types';

// Actions
import { getProductHistory } from '@/actions/inventory';

// Shadcn
import { toast } from 'sonner';

// ---------------------------------------------------------
// 1. Types for the Props
// ---------------------------------------------------------
export interface HistoryEntry {
  _id: string;
  reason: string;
  change: number; // e.g. +5 or -2
  newStock: number; // The stock snapshot after change
  createdAt: string; // ISO Date
  userName: string;
}

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: ProductRow;
}

// ---------------------------------------------------------
// 2. Helper: Reason Formatter & Color Coding
// ---------------------------------------------------------
const getReasonBadge = (reason: string) => {
  // Map internal Enum to human readable
  const labels: Record<string, string> = {
    [InventoryReason.MANUAL_ADJUSTMENT]: 'Manual Adjustment',
    [InventoryReason.DAMAGED_GOODS]: 'Damaged / Expired',
    [InventoryReason.THEFT_OR_LOSS]: 'Theft / Loss',
    [InventoryReason.RETURN_RESTOCK]: 'Restock (Return)',
    [InventoryReason.RECEIVED_INVENTORY]: 'Shipment Received',
    [InventoryReason.INITIAL_COUNT]: 'Initial Count',
    // Fallback for system events
    [InventoryReason.ORDER_FULFILLMENT]: 'Order Fulfillment',
  };

  const label = labels[reason] || reason;

  // Style based on context
  let colorClass = 'text-slate-400 bg-slate-800'; // Default

  if (reason === InventoryReason.DAMAGED_GOODS || reason === InventoryReason.THEFT_OR_LOSS) {
    colorClass = 'text-red-400 bg-red-950/30 border border-red-900/50';
  } else if (reason === InventoryReason.RECEIVED_INVENTORY || reason === InventoryReason.RETURN_RESTOCK) {
    colorClass = 'text-emerald-400 bg-emerald-950/30 border border-emerald-900/50';
  } else if (reason === InventoryReason.MANUAL_ADJUSTMENT) {
    colorClass = 'text-blue-400 bg-blue-950/30 border border-blue-900/50';
  }

  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>{label}</span>;
};

// ---------------------------------------------------------
// 3. The Component
// ---------------------------------------------------------
export const ProductHistoryModal = ({ isOpen, onClose, selectedProduct }: ProductHistoryModalProps) => {
  // States
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Effects
  useEffect(() => {
    let isMounted = true; // 🛡️ The "Ignore" flag

    const fetchHistory = async () => {
      setIsLoading(true);

      const { success, data, message } = await getProductHistory(selectedProduct._id);

      // 🚫 Only update state if the component hasn't unmounted or changed IDs
      if (isMounted) {
        // Success
        if (success && data) setHistory(data);
        // Message
        else {
          toast.error(message);
          setErrorMsg(message);
        }

        setIsLoading(false);
      }
    };

    fetchHistory();

    // 🧹 Cleanup function
    return () => {
      isMounted = false;
    };
  }, [selectedProduct._id]);

  // Rendering Constants
  const isEmpty = !isLoading && history.length === 0;

  return (
    <ModalShell isOpen={isOpen}>
      {/* Header */}
      <ModalHeader title="Stock History" description={<span className="font-mono text-indigo-400">{selectedProduct.name}</span>} onClose={onClose} />

      {/* Content Area - Scrollable */}
      <div className="custom-scrollbar max-h-[60vh] overflow-y-auto pr-2">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="h-4 w-24 rounded bg-slate-800"></div>
                <div className="h-4 w-12 rounded bg-slate-800"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <svg className="mb-3 h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">{errorMsg || 'No history recorded yet.'}</p>
          </div>
        )}

        {/* Timeline List */}
        {!isLoading && !isEmpty && (
          <div className="space-y-3">
            {history.map((entry) => {
              const isPositive = entry.change > 0;
              const dateObj = new Date(entry.createdAt);

              return (
                <div key={entry._id} className="group relative flex flex-col gap-2 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/50">
                  <div className="flex items-start justify-between">
                    {/* Left: Reason & User */}
                    <div className="flex flex-col gap-1.5">
                      <div>{getReasonBadge(entry.reason)}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{format(dateObj, 'MMM d, yyyy • h:mm a')}</span>
                        {entry.userName && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-700"></span>
                            <span>{entry.userName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: The Math */}
                    <div className="text-right">
                      <div className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}
                        {entry.change}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Running: <span className="font-mono text-slate-300">{entry.newStock}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Modified to be "Read Only" friendly */}
      <div className="mt-6 border-t border-slate-800 pt-4">
        <button onClick={onClose} className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:text-white">
          Close
        </button>
      </div>
    </ModalShell>
  );
};
