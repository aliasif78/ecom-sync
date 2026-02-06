// Providers
import { ProductModalsProvider } from '@/contexts/ProductModalsProvider';

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductModalsProvider>
      {/* All child pages now have access to the modal */}
      {children}
    </ProductModalsProvider>
  );
}
