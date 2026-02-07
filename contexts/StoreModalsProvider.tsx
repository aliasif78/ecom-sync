'use client';

// React
import { createContext, useContext, useState, ReactNode } from 'react';

// Components (We will build these next)
import { AddStoreModal } from '@/components/stores/modals/AddStoreModal';
import { EditStoreModal } from '@/components/stores/modals/EditStoreModal';

// Interfaces
import { StoreRow } from '@/types';

// Types
type ModalType = 'EDIT' | 'ADD' | null;

interface StoreModalsContextType {
  openEditStoreModal: (store: StoreRow) => void;
  openAddStoreModal: () => void;
  closeModal: () => void;
}

// Context
const StoreModalsContext = createContext<StoreModalsContextType | undefined>(undefined);

// Provider
export function StoreModalsProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);

  // --- Handlers ---
  const openEditStoreModal = (store: StoreRow) => {
    setSelectedStore(store);
    setActiveModal('EDIT');
  };

  const openAddStoreModal = () => {
    setSelectedStore(null);
    setActiveModal('ADD');
  };

  const closeModal = () => {
    setActiveModal(null);
    setTimeout(() => setSelectedStore(null), 300);
  };

  return (
    <StoreModalsContext.Provider value={{ openEditStoreModal, openAddStoreModal, closeModal }}>
      {children}

      {/* --- The Modals Layer --- */}

      {/* 1. Add Modal */}
      {activeModal === 'ADD' && <AddStoreModal isOpen={true} onClose={closeModal} />}

      {/* 2. Edit Modal */}
      {activeModal === 'EDIT' && selectedStore && <EditStoreModal key={selectedStore._id} isOpen={true} onClose={closeModal} store={selectedStore} />}
    </StoreModalsContext.Provider>
  );
}

// Custom Hook
export const useStoreModals = () => {
  const context = useContext(StoreModalsContext);
  if (!context) throw new Error('useStoreModals must be used within a StoreModalsProvider');
  return context;
};
