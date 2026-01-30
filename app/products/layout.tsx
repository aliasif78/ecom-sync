// Providers
import { SyncModalProvider } from '@/contexts/SyncModalProvider';

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SyncModalProvider>
      {/* All child pages now have access to the modal */}
      {children}
    </SyncModalProvider>
  );
}
