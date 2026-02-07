import { ModalShell, ModalHeader } from '@/components/products/modals/Atoms'; // Reuse atoms!

export const AddStoreModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Connect New Store" onClose={onClose} />
      <div className="p-4 text-slate-400">Form coming soon...</div>
    </ModalShell>
  );
};
