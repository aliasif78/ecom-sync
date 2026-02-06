'use client';

// Next JS
import Image from 'next/image';

// Contexts
import { useProductModals } from '@/contexts/ProductModalsProvider';

// Types
import { ProductRow } from '@/types';

// Interfaces
// Define the shape of the data strictly for the Frontend
// We do NOT import IProduct because that is for the backend only.

// Use this lightweight type instead of the heavy IProduct
interface Props {
  products: ProductRow[];
}

// ==========================================
// Helper Functions
// ==========================================
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const getStockStatus = (stock: number) => {
  if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' };
  if (stock < 10) return { label: 'Low Stock', color: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30' };
  return { label: 'In Stock', color: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' };
};

// ==========================================
// Component
// ==========================================
const ProductTable = ({ products }: Props) => {
  // Contexts
  const { openSyncModal } = useProductModals();

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/50 px-8 py-6 backdrop-blur-sm">
        <div>
          <h3 className="text-2xl font-bold text-white">Global Inventory</h3>
          <p className="mt-1 text-sm text-slate-400">Real-time stock levels across all channels</p>
        </div>

        <span className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-purple-300 shadow-lg">{products.length} Products</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-8 py-4 text-left text-xs font-bold tracking-widest text-slate-400 uppercase">Product</th>
              <th className="px-8 py-4 text-left text-xs font-bold tracking-widest text-slate-400 uppercase">Price</th>
              <th className="px-8 py-4 text-left text-xs font-bold tracking-widest text-slate-400 uppercase">Status</th>
              <th className="px-8 py-4 text-left text-xs font-bold tracking-widest text-slate-400 uppercase">Inventory</th>
              <th className="px-8 py-4 text-right text-xs font-bold tracking-widest text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5 bg-slate-900/30">
            {products.map((product) => {
              const stockStatus = getStockStatus(product.stock);

              return (
                <tr key={product._id} className="group transition-all duration-300 hover:bg-white/5">
                  {/* Column 1: Product */}
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800">
                        {/* <Image src={product.image} alt={product.name} fill className="object-cover" sizes="56px" /> */}
                        <img src={product.image} alt={product.name} className="h-10 w-10 rounded object-cover" />
                      </div>

                      <div>
                        <div className="text-base font-semibold text-slate-100">{product.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">{product.sku}</div>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Price */}
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="text-base font-bold text-emerald-400">{formatCurrency(product.price)}</div>
                  </td>

                  {/* Column 3: Status */}
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ring-1 ${stockStatus.color}`}>{stockStatus.label}</span>
                  </td>

                  {/* Column 4: Stock */}
                  <td className="px-8 py-5 text-sm whitespace-nowrap">
                    <span className="font-mono text-lg font-bold text-slate-200">{product.stock}</span>
                    <span className="ml-1 text-slate-500">units</span>
                  </td>

                  {/* Column 5: Actions */}
                  <td className="px-8 py-5 text-right text-sm font-medium whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                      {/* 1. Edit Button (Ghost Style) */}
                      <button type="button" className="group/edit relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-400" title="Edit Product">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* 2. Delete Button (Danger Ghost Style) */}
                      <button type="button" className="group/delete relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400" title="Delete Product">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      {/* 3. Sync Button (Primary Action - Kept Prominent) */}
                      <button onClick={() => openSyncModal(product)} className="ml-2 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/40">
                        <svg className="animate-spin-slow h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Sync</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductTable;
