'use client';

// Contenxts
import { useProductModals } from '@/contexts/ProductModalsProvider';

// Interfaces
interface props {
  totalStock: number;
  lowStockCount: number;
}

const ProductHeader = ({ totalStock, lowStockCount }: props) => {
  // Contexts
  const { openAddModal } = useProductModals();

  return (
    <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Inventory Intelligence</h1>
        <p className="mt-2 text-slate-400">Manage your global product catalog and synchronization status.</p>
      </div>

      {/* Quick Stats Row (Optional but looks pro) */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2">
          <span className="block text-xs font-bold tracking-wider text-slate-500 uppercase">Total Units</span>
          <span className="font-mono text-xl font-bold text-indigo-400">{totalStock.toLocaleString()}</span>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2">
          <span className="block text-xs font-bold tracking-wider text-slate-500 uppercase">Low Stock</span>
          <span className="font-mono text-xl font-bold text-amber-400">{lowStockCount}</span>
        </div>

        {/* Primary Action Button */}
        <button onClick={openAddModal} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
