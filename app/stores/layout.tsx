// Providers
import { StoreModalsProvider } from '@/contexts/StoreModalsProvider';

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreModalsProvider>
      {/* All child pages now have access to the modal */}
      {children}
    </StoreModalsProvider>
  );
}
