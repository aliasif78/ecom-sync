'use client';

// React
import { useState, useMemo } from 'react';

// Components
import { Table } from '@/components/shared/Table';
import { ActionButton, Icons } from '@/components/shared/TableActions';

// Contexts & Actions
import { useProductModals } from '@/contexts/ProductModalsProvider';
import { deleteProduct } from '@/actions/products';

// Types
import { ProductRow } from '@/types';

// Icons
import { PiSparkleFill } from 'react-icons/pi';

// Server Actions
import { forceSyncAllProducts } from '@/actions/inventory';

// Next Js
import Image from 'next/image';

// Dependencies
import { toast } from 'sonner';
import posthog from 'posthog-js';

// Constants
import { FORCE_SYNC_ALL_PRODUCTS_CLICKED } from '@/lib/posthog/constants';

// Interfaces
interface Props {
  products: ProductRow[];
  isSyncing: string[];
  /**
   * productIds (as strings) with an OPEN STOCKOUT_RISK alert, from
   * lib/alerts/index.ts's getOpenStockoutRiskProductIds. Replaces the old
   * product.stockoutRisk boolean — see Product.ts for why that field was
   * removed. Membership in this list drives the "Stockout Risk" badge below.
   */
  stockoutRiskProductIds: string[];
}

// Helpers
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const getStockStatus = (stock: number) => {
  if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' };
  if (stock < 10) return { label: 'Low Stock', color: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30' };
  return { label: 'In Stock', color: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' };
};

// Custom Components
const Spinner = ({ spin }: { spin?: boolean }) => (
  <div className={spin ? 'animate-spin' : ''}>
    <Icons.Sync />
  </div>
);

const ProductTable = ({ products, isSyncing, stockoutRiskProductIds }: Props) => {
  // States
  const [disableForceSyncAll, setDisableForceSyncAll] = useState(false);
  const [disabledDeleteId, setDisabledDeleteId] = useState<string[]>([]);

  // Hooks
  const { openSyncModal, openEditModal, openHistoryModal } = useProductModals();

  // O(1) membership check per row instead of an .includes() scan — cheap
  // either way at this scale, but no reason not to do it properly.
  const stockoutRiskSet = useMemo(() => new Set(stockoutRiskProductIds), [stockoutRiskProductIds]);

  // Functions
  const handleDelete = async (id: string) => {
    if (disabledDeleteId.includes(id)) return;

    if (confirm('Are you sure that you want to delete this product?')) {
      setDisabledDeleteId((prev) => [...prev, id]);
      const { success, message } = await deleteProduct(id);

      if (success) toast.success(message);
      else toast.error(message);

      setDisabledDeleteId((prev) => prev.filter((i) => i !== id));
    }
  };

  const syncModalHandler = (product: ProductRow) => {
    if (!isSyncing.includes(product.sku)) openSyncModal(product);
  };

  const handleForceSyncAll = async () => {
    if (disableForceSyncAll) return;
    posthog.capture(FORCE_SYNC_ALL_PRODUCTS_CLICKED, { current_route: '/products' });

    setDisableForceSyncAll(true);
    const res = await forceSyncAllProducts();

    if (res.success) toast.success(res.message);
    else toast.error(res.message);

    setDisableForceSyncAll(false);
  };

  // Constants
  const IS_SYNCING_ANY = disableForceSyncAll || isSyncing.length > 0;

  return (
    <Table title="Global Inventory" description="Real-time stock levels across all channels" recordCount={products.length} headers={['Product', 'Price', 'Status', 'Inventory', 'Actions']} headerBtn={{ label: IS_SYNCING_ANY ? 'Syncing...' : 'Force Sync All', icon: IS_SYNCING_ANY ? <Spinner spin /> : <PiSparkleFill />, onClick: () => handleForceSyncAll(), disabled: IS_SYNCING_ANY }}>
      {products.map((product) => {
        const stockStatus = getStockStatus(product.stock);
        const disableSync = isSyncing.includes(product.sku);
        const hasStockoutRisk = stockoutRiskSet.has(product._id);

        return (
          <tr key={product._id} className="group transition-all duration-300 hover:bg-white/5">
            {/* Product */}
            <td className="px-8 py-5 whitespace-nowrap">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800">
                  <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 300px" className="rounded-lg object-cover" />
                </div>
                <div className="space-y-2">
                  <div className="text-base font-semibold text-slate-100">{product.name}</div>
                  <div className="font-mono text-xs text-slate-500">{product.sku}</div>

                  {/* 🧠 STOCKOUT RISK BADGE — now backed by an OPEN STOCKOUT_RISK Alert
                      (lib/alerts/index.ts), not the removed product.stockoutRisk field. */}
                  {hasStockoutRisk && (
                    <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                      <PiSparkleFill className="h-3 w-3" /> Stockout Risk
                    </span>
                  )}
                </div>
              </div>
            </td>

            {/* Price */}
            <td className="px-8 py-5 whitespace-nowrap">
              <div className="text-base font-bold text-emerald-400">{formatCurrency(product.price)}</div>
            </td>

            {/* Status */}
            <td className="px-8 py-5 whitespace-nowrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ring-1 ${stockStatus.color}`}>{stockStatus.label}</span>
            </td>

            {/* Inventory */}
            <td className="px-8 py-5 text-sm whitespace-nowrap">
              <span className="font-mono text-lg font-bold text-slate-200">{product.stock}</span>
              <span className="ml-1 text-slate-500">units</span>
            </td>

            {/* Actions */}
            <td className="px-8 py-5 text-right text-sm font-medium whitespace-nowrap">
              <div className="flex items-center justify-end gap-3">
                <ActionButton icon={<Icons.History />} onClick={() => openHistoryModal(product)} title="View History" />
                <ActionButton icon={<Icons.Edit />} onClick={() => openEditModal(product)} title="Edit Product" disabled={disableSync} />
                <ActionButton icon={<Icons.Delete />} onClick={() => handleDelete(product._id)} variant="danger" title="Delete Product" disabled={disableSync || disabledDeleteId.includes(product._id)} />

                {/* Primary Sync Button */}
                <button disabled={disableSync} onClick={() => syncModalHandler(product)} className="ml-2 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50">
                  <Spinner spin={disableSync} />
                  <span>{disableSync ? 'Syncing...' : 'Sync'}</span>
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </Table>
  );
};

export default ProductTable;
