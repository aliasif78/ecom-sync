'use client';

import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter, ModalToggle } from '@/components/products/modals/Atoms'; // Adjust path
import { StoreRow } from '@/types'; // Or wherever StoreRow is defined

export const EditStoreModal = ({ isOpen, onClose, store }: { isOpen: boolean; onClose: () => void; store: StoreRow }) => {
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState(store.name || '');
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(store.isSyncEnabled || true);

  // Credentials State (We only store what the user *changes*)
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    // Simulate API Call
    console.log('Updating Store:', { _id: store._id, name, isSyncEnabled, credentials }); // credentials will only have *new* values
    setTimeout(() => {
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  // --- Render Platform Specific Inputs (Write-Only) ---
  const renderCredentialFields = () => {
    switch (store.platform) {
      case 'SHOPIFY':
        return (
          <>
            <ModalInput label="Update Access Token" placeholder="Leave blank to keep current token" value={credentials.accessToken || ''} onChange={(e) => handleCredentialChange('accessToken', e.target.value)} type="password" className="font-mono text-sm" />
            <ModalInput
              label="Update Shop Domain"
              placeholder={store.name.toLowerCase().replace(/\s/g, '-') + '.myshopify.com'} // Just a hint
              value={credentials.shopUrl || ''}
              onChange={(e) => handleCredentialChange('shopUrl', e.target.value)}
              className="font-mono text-sm"
            />
          </>
        );
      case 'AMAZON':
        return <ModalInput label="Update Mock API Key" placeholder="Leave blank to keep current key" value={credentials.apiKey || ''} onChange={(e) => handleCredentialChange('apiKey', e.target.value)} className="font-mono text-sm" />;
      case 'WOOCOMMERCE':
        return (
          <>
            <ModalInput label="Update Consumer Key" placeholder="Leave blank to keep current key" value={credentials.consumerKey || ''} onChange={(e) => handleCredentialChange('consumerKey', e.target.value)} className="font-mono text-sm" />
            <ModalInput label="Update Consumer Secret" placeholder="Leave blank to keep current secret" value={credentials.consumerSecret || ''} onChange={(e) => handleCredentialChange('consumerSecret', e.target.value)} className="font-mono text-sm" />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Store Connection" description={`Manage settings for ${store.name}`} onClose={onClose} />

      <div className="flex flex-col gap-6">
        {/* 1. Read-Only Identity */}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
          <span className="font-bold"></span> You are editing a <span className="font-bold underline">{store.platform}</span> connection.
        </div>

        {/* 2. General Settings */}
        <div className="space-y-4">
          <ModalInput label="Store Nickname" value={name} onChange={(e) => setName(e.target.value)} />

          <ModalToggle label="Automatic Synchronization" description="If disabled, stock updates won't be pushed to this store." checked={isSyncEnabled} onChange={setIsSyncEnabled} />
        </div>

        {/* 3. Credential Rotation (Collapsible-ish) */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-slate-900 px-2 text-xs font-medium tracking-widest text-slate-500 uppercase">Update Credentials</span>
          </div>
        </div>

        <div className="animate-in fade-in space-y-4 duration-500">{renderCredentialFields()}</div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
};
