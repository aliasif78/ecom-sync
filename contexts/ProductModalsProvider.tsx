'use client';

// React
import { createContext, useContext, useState, ReactNode } from 'react';

// Components
import SyncStockModal from '@/components/products/modals/SyncStockModal';
import EditProductModal from '@/components/products/modals/EditProductModal';
import AddProductModal from '@/components/products/modals/AddProductModal';
import { ProductHistoryModal } from '@/components/products/modals/HistoryModal'; // 👈 Added Import

// Interfaces
import { ProductRow } from '@/types';

// Types
type ModalType = 'SYNC' | 'EDIT' | 'ADD' | 'HISTORY' | null; // 👈 Added HISTORY

interface ProductModalsContextType {
  openSyncModal: (product: ProductRow) => void;
  openEditModal: (product: ProductRow) => void;
  openHistoryModal: (product: ProductRow) => void; // 👈 Added Interface
  openAddModal: () => void;
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
  const openModalHelper = (modalType: ModalType, product?: ProductRow) => {
    setSelectedProduct(product || null);
    setActiveModal(modalType);
  };

  const openSyncModal = (product: ProductRow) => openModalHelper('SYNC', product);
  const openEditModal = (product: ProductRow) => openModalHelper('EDIT', product);
  const openHistoryModal = (product: ProductRow) => openModalHelper('HISTORY', product); // 👈 Added Handler
  const openAddModal = () => openModalHelper('ADD');

  const closeModal = () => {
    setActiveModal(null);

    // Optional: wait for animation to finish before clearing product,
    // but usually setting it to null immediately is fine.
    setTimeout(() => setSelectedProduct(null), 300);
  };

  return (
    <ProductModalsContext.Provider value={{ openSyncModal, openEditModal, openHistoryModal, openAddModal, closeModal }}>
      {children}

      {/* --- The Modals Layer --- */}

      {/* 1. Sync Modal */}
      {activeModal === 'SYNC' && selectedProduct && <SyncStockModal key={selectedProduct._id} isOpen={true} onClose={closeModal} product={selectedProduct} />}

      {/* 2. Edit Modal */}
      {activeModal === 'EDIT' && selectedProduct && <EditProductModal key={selectedProduct._id} isOpen={true} onClose={closeModal} product={selectedProduct} />}

      {/* 3. History Modal */}
      {activeModal === 'HISTORY' && selectedProduct && <ProductHistoryModal key={selectedProduct._id} isOpen={true} onClose={closeModal} selectedProduct={selectedProduct} />}

      {/* 4. Add Modal */}
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
