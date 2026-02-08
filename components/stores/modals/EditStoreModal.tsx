'use client';

// React
import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter, ModalToggle } from '@/components/products/modals/Atoms';
import { PlatformFields } from '@/components/products/modals/PlatformFields';
import Divider from '@/components/products/modals/Divider';

// Types
import { StoreRow } from '@/types';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// Server Actions
import { editStoreByIdAction } from '@/actions/stores';

// Shadcn
import { toast } from 'sonner';

export const EditStoreModal = ({ isOpen, onClose, store }: { isOpen: boolean; onClose: () => void; store: StoreRow }) => {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(store.name || '');
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(store.isSyncEnabled || true);
  const [credentials, setCredentials] = useState<Record<string, string>>(store.config || {});

  // Functions
  const handleCredentialChange = (key: string, value: string) => setCredentials((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setIsLoading(true);
    const res = await editStoreByIdAction(store._id, { name, config: credentials, isSyncEnabled });

    // Success
    if (res.success) {
      onClose();
      toast.success(res.message);
    }

    // Error
    else toast.error(res.message);

    setIsLoading(false);
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Store Connection" description={`Manage settings for ${store.name}`} onClose={onClose} />

      <div className="flex flex-col gap-6">
        {/* 1. Read-Only Identity */}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
          You are editing a <span className="font-bold underline">{store.platform}</span> connection.
        </div>

        {/* 2. General Settings */}
        <div className="space-y-4">
          <ModalInput label="Store Nickname" value={name} onChange={(e) => setName(e.target.value)} />
          <ModalToggle label="Automatic Synchronization" description="Push stock updates to this store." checked={isSyncEnabled} onChange={setIsSyncEnabled} />
        </div>

        {/* 3. Credential Rotation (Collapsible-ish) */}
        <Divider title="Update Credentials" />

        <div className="animate-in fade-in space-y-4 duration-500">
          <PlatformFields mode="edit" platform={store.platform as EPlatform} data={credentials} onChange={handleCredentialChange} />
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
};
