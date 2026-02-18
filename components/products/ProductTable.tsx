'use client';

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
import { forceSyncAllProducts } from '@/actions/inventory';

// Constants
import { MUTEX_ALL } from '@/lib/globalConstants';

// Interfaces
interface Props {
  products: ProductRow[];
  isSyncing: string[];
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

const ProductTable = ({ products, isSyncing }: Props) => {
  // Hooks
  const { openSyncModal, openEditModal, openHistoryModal } = useProductModals();

  // Functions
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure that you want to delete this product?')) await deleteProduct(id);
  };

  const syncModalHandler = (product: ProductRow) => {
    if (!isSyncing.includes(product.sku)) openSyncModal(product);
  };

  // Constants
  const IS_SYNCING_ALL = isSyncing[0] === MUTEX_ALL;

  return (
    <Table title="Global Inventory" description="Real-time stock levels across all channels" recordCount={products.length} headers={['Product', 'Price', 'Status', 'Inventory', 'Actions']} headerBtn={{ label: IS_SYNCING_ALL ? 'Syncing...' : 'Force Sync All', icon: IS_SYNCING_ALL ? <Spinner spin /> : <PiSparkleFill />, onClick: () => forceSyncAllProducts(), disabled: isSyncing.length > 0 }}>
      {products.map((product) => {
        const stockStatus = getStockStatus(product.stock);
        const isThisSyncing = isSyncing.includes(product.sku);
        const disableSync = isThisSyncing || IS_SYNCING_ALL;

        return (
          <tr key={product._id} className="group transition-all duration-300 hover:bg-white/5">
            {/* Product */}
            <td className="px-8 py-5 whitespace-nowrap">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-100">{product.name}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{product.sku}</div>
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
                <ActionButton icon={<Icons.Edit />} onClick={() => openEditModal(product)} title="Edit Product" />
                <ActionButton icon={<Icons.Delete />} onClick={() => handleDelete(product._id)} variant="danger" title="Delete Product" />

                {/* Primary Sync Button */}
                <button disabled={disableSync} onClick={() => syncModalHandler(product)} className="ml-2 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50">
                  <Spinner spin={isThisSyncing} />
                  <span>{isThisSyncing ? 'Syncing...' : 'Sync'}</span>
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
