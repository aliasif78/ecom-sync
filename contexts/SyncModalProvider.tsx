'use client';

// React
import { createContext, useContext, useState, ReactNode } from 'react';

// Components
import SyncStockModal from '@/components/products/modals/SyncStockModal';
import EditProductModal from '@/components/products/modals/EditProductModal'; // New
import AddProductModal from '@/components/products/modals/AddProductModal';

// Interfaces
import { ProductRow } from '@/types';

// Types
type ModalType = 'SYNC' | 'EDIT' | 'ADD' | null;

interface ProductModalsContextType {
  openSyncModal: (product: ProductRow) => void;
  openEditModal: (product: ProductRow) => void;
  openAddModal: () => void; // Add doesn't need a product
  closeModal: () => void;
}

// Context
const ProductModalsContext = createContext<ProductModalsContextType | undefined>(undefined);

// Provider
export function ProductModalsProvider({ children }: { children: ReactNode }) {
  // State: We use a single 'activeModal' string to ensure only one is open at a time
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  // --- Handlers ---

  const openSyncModal = (product: ProductRow) => {
    setSelectedProduct(product);
    setActiveModal('SYNC');
  };

  const openEditModal = (product: ProductRow) => {
    setSelectedProduct(product);
    setActiveModal('EDIT');
  };

  const openAddModal = () => {
    setSelectedProduct(null); // Clear selection for fresh add
    setActiveModal('ADD');
  };

  const closeModal = () => {
    setActiveModal(null);
    // Optional: wait for animation to finish before clearing product,
    // but usually setting it to null immediately is fine.
    setTimeout(() => setSelectedProduct(null), 300);
  };

  return (
    <ProductModalsContext.Provider value={{ openSyncModal, openEditModal, openAddModal, closeModal }}>
      {children}

      {/* --- The Modals Layer --- */}

      {/* 1. Sync Modal */}
      {activeModal === 'SYNC' && selectedProduct && <SyncStockModal isOpen={true} onClose={closeModal} product={selectedProduct} />}

      {/* 2. Edit Modal */}
      {activeModal === 'EDIT' && selectedProduct && (
        <EditProductModal
          isOpen={true}
          onClose={closeModal}
          product={selectedProduct} // Pass the product to pre-fill the form
        />
      )}

      {/* 3. Add Modal */}
      {activeModal === 'ADD' && <AddProductModal isOpen={true} onClose={closeModal} />}
    </ProductModalsContext.Provider>
  );
}

// Custom Hook
export const useProductModals = () => {
  const context = useContext(ProductModalsContext);
  if (!context) throw new Error('useProductModals must be used within a ProductModalsProvider');
  return context;
};
