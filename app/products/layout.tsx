// Providers
import { ProductModalsProvider } from '@/contexts/ProductModalsProvider';

// Components
import SyncPusherHandler from '@/components/products/SyncPusher';

// Utils
import { getCurrentUser } from '@/lib/users';

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentUser();

  return (
    <ProductModalsProvider>
      <SyncPusherHandler userId={user?.id} />

      {/* All child pages now have access to the modal */}
      {children}
    </ProductModalsProvider>
  );
}
