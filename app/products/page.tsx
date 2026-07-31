export const dynamic = 'force-dynamic';

// Server Component

// API
import { getProducts } from '@/lib/products';
import { getCurrentUser } from '@/lib/users';
import { getOpenStockoutRiskProductIds } from '@/lib/alerts/index';

// Components
import ProductHeader from '@/components/products/ProductHeader';
import ProductTable from '@/components/products/ProductTable';
import ErrorMessage from '@/components/shared/ErrorMessage';
import RedisStressTest from '@/components/shared/RedisStressTest';
import Copilot from '@/components/shared/Copilot';

const Page = async () => {
  // API
  const { success: authSuccess, user } = await getCurrentUser();

  if (!authSuccess || !user) {
    return <ErrorMessage message="You must be logged in to view products." />;
  }

  const userId = user._id.toString();
  const { products, success, message } = await getProducts(userId);

  if (!success) {
    console.error(`🚩 Page Load Error: ${message}`);
    return <ErrorMessage message={message} />;
  }

  const stockoutRiskProductIds = await getOpenStockoutRiskProductIds(userId);

  // Constants
  const isSyncing = user.isSyncing || [];

  // Calculate some quick stats for the header
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock < 10).length;

  return (
    // Page Container - Dark theme to match the table
    <div className="min-h-screen bg-slate-950 p-8 pt-26 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Redis Distributed Lock Button */}
        <RedisStressTest />

        {/* AI Copilot */}
        <Copilot />

        {/* Page Header Area */}
        <ProductHeader totalStock={totalStock} lowStockCount={lowStockCount} />

        {/* The Main Data Table */}
        <ProductTable products={products} isSyncing={isSyncing} stockoutRiskProductIds={stockoutRiskProductIds} />
      </div>
    </div>
  );
};

export default Page;
