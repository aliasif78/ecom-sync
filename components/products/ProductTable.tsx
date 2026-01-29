'use client';

// Interfaces
// Define the shape of the data strictly for the Frontend

import Image from 'next/image';

// We do NOT import IProduct because that is for the backend only.
export interface ProductRow {
  _id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  createdAt?: string; // It comes as a string from the server
  updatedAt?: string;
}

// Use this lightweight type instead of the heavy IProduct
interface Props {
  products: ProductRow[];
}

// ==========================================
// Helper Functions (Clean Code Pattern)
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
                        <Image src={product.image} alt={product.name} fill className="object-cover" sizes="56px" />
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
                    <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-lg transition-all hover:bg-indigo-500">Sync Now</button>
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
