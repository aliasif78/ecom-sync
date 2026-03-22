// Server Component

// API
import { getProducts } from '@/lib/products';
import { getCurrentUser } from '@/lib/users';

// Components
import ProductHeader from '@/components/products/ProductHeader';
import ProductTable from '@/components/products/ProductTable';
import ErrorMessage from '@/components/shared/ErrorMessage';
import RedisStressTest from '@/components/shared/RedisStressTest';

const Page = async () => {
  // API
  const { user } = await getCurrentUser();
  const { products, success, message } = await getProducts(user?._id.toString());

  if (!success) {
    console.error(`🚩 Page Load Error: ${message}`);
    return <ErrorMessage message={message} />;
  }

  // Constants
  const isSyncing = user?.isSyncing || [];

  // Calculate some quick stats for the header
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock < 10).length;

  return (
    // Page Container - Dark theme to match the table
    <div className="min-h-screen bg-slate-950 p-8 pt-26 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        {/* Redis Distributed Lock Button */}
        <RedisStressTest />

        {/* Page Header Area */}
        <ProductHeader totalStock={totalStock} lowStockCount={lowStockCount} />

        {/* The Main Data Table */}
        <ProductTable products={products} isSyncing={isSyncing} />
      </div>
    </div>
  );
};

export default Page;
