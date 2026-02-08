'use client';

// React
import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalSelect, ModalFooter, ModalToggle } from '@/components/products/modals/Atoms';
import { PlatformFields } from '@/components/products/modals/PlatformFields';

// Shadcn
import { toast } from 'sonner';

// Server Actions
import { addStoreAction } from '@/actions/stores';

// Constants
import { EPlatform } from '@/lib/globalConstants';
import Divider from '@/components/products/modals/Divider';

// Types
const PLATFORM_OPTIONS = [
  { value: EPlatform.SHOPIFY, label: 'Shopify' },
  { value: EPlatform.AMAZON, label: 'Amazon (Mock)' },
  { value: EPlatform.WOOCOMMERCE, label: 'WooCommerce' },
];

export const AddStoreModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [platform, setPlatform] = useState<EPlatform>(EPlatform.SHOPIFY);

  // Flat State for Form Inputs (easier to manage in UI)
  const [formData, setFormData] = useState({ name: '', shopUrl: '', accessToken: '', apiKey: '', endpoint: 'US', consumerKey: '', consumerSecret: '', isSyncEnabled: true });

  // Helper to update state
  const handleChange = (field: string, value: string | boolean) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // 1. Construct the 'Config' object based on the platform
      // This maps the flat form state to the nested structure Zod expects
      let config: Record<string, unknown> = {};

      if (platform === EPlatform.SHOPIFY) config = { shopUrl: formData.shopUrl, accessToken: formData.accessToken };
      else if (platform === EPlatform.AMAZON) config = { apiKey: formData.apiKey, endpoint: formData.endpoint };
      else if (platform === EPlatform.WOOCOMMERCE) config = { shopUrl: formData.shopUrl, consumerKey: formData.consumerKey, consumerSecret: formData.consumerSecret };

      // 2. Call the Server Action
      const result = await addStoreAction({ name: formData.name, platform, isSyncEnabled: formData.isSyncEnabled, config });

      // 3. Handle Response
      if (result.success) {
        toast.success(result.message);
        onClose();
      }

      // Optional: Reset form here if you want
      else toast.error(result.message || 'Failed to add store');
    } catch (error) {
      console.error(error);
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Connect New Store" description="Link an external sales channel." onClose={onClose} />

      <div className="flex flex-col gap-5">
        {/* Common Fields */}
        <ModalInput label="Store Nickname" placeholder="e.g. Main US Store" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} autoFocus />
        <ModalSelect label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as EPlatform)} options={PLATFORM_OPTIONS} />
        <ModalToggle label="Automatic Synchronization" description="Push stock updates to this store." checked={formData.isSyncEnabled} onChange={(c) => handleChange('isSyncEnabled', c)} />

        <Divider title="Credentials" />

        {/* Dynamic Fields */}
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-4 duration-300">
          <PlatformFields mode="create" platform={platform} data={formData} onChange={handleChange} />
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Connect Store" />
    </ModalShell>
  );
};
