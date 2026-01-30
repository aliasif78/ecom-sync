'use client'; // 👈 This is the boundary

// React
import { createContext, useContext, useState, ReactNode } from 'react';

// Components
import SyncStockModal from '@/components/products/SyncStockModal'; // Your Modal Component

// Interfaces
import { ProductRow } from '@/components/products/ProductTable';

// Interfaces
interface SyncModalContextType {
  openModal: (product: ProductRow) => void;
  closeModal: () => void;
}

// Context
const SyncModalContext = createContext<SyncModalContextType | undefined>(undefined);

// Provider
export function SyncModalProvider({ children }: { children: ReactNode }) {
  // States
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  // Functions
  const openModal = (product: ProductRow) => {
    setSelectedProduct(product);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setSelectedProduct(null);
  };

  return (
    <SyncModalContext.Provider value={{ openModal, closeModal }}>
      {children}

      {/* The Modal lives here, always available but hidden until triggered */}
      {isOpen && <SyncStockModal isOpen={isOpen} onClose={closeModal} product={selectedProduct} />}
    </SyncModalContext.Provider>
  );
}

// Custom Hook for easy access
export const useSyncModal = () => {
  const context = useContext(SyncModalContext);
  if (!context) throw new Error('useSyncModal must be used within a SyncModalProvider');

  return context;
};
