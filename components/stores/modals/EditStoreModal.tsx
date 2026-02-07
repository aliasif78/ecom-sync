import { ModalShell, ModalHeader } from '@/components/products/modals/Atoms';
import { StoreRow } from '@/types';

export const EditStoreModal = ({ isOpen, onClose, store }: { isOpen: boolean; onClose: () => void; store: StoreRow }) => {
  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Store Connection" description={store.name} onClose={onClose} />
      <div className="p-4 text-slate-400">Form coming soon...</div>
    </ModalShell>
  );
};
