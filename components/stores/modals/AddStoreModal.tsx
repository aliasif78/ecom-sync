'use client';

// React
import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalSelect, ModalFooter, ModalToggle } from '@/components/products/modals/Atoms';
import { toast } from 'sonner'; // Assuming you use Sonner or similar

// Server Actions
import { addStoreAction } from '@/actions/stores';

// Constants
import { EPlatform } from '@/lib/globalConstants';

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

  // --- Render Platform Specific Fields ---
  const renderPlatformFields = () => {
    switch (platform) {
      case EPlatform.SHOPIFY:
        return (
          <>
            <ModalInput label="Shopify Store Domain" placeholder="e.g. my-brand.myshopify.com" value={formData.shopUrl} onChange={(e) => handleChange('shopUrl', e.target.value)} className="font-mono text-sm" />
            <ModalInput label="Access Token" placeholder="shpat_xxxxxxxxxxxxxxxx" value={formData.accessToken} onChange={(e) => handleChange('accessToken', e.target.value)} className="font-mono text-sm" />
          </>
        );

      case EPlatform.AMAZON:
        return (
          <>
            <ModalInput label="Mock API Key" placeholder="AMZN-MOCK-KEY-..." value={formData.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="font-mono text-sm" />
            <ModalSelect
              label="Marketplace Region"
              value={formData.endpoint}
              onChange={(e) => handleChange('endpoint', e.target.value)}
              options={[
                { value: 'US', label: 'North America (US/CA/MX)' },
                { value: 'EU', label: 'Europe (UK/DE/FR)' },
              ]}
            />
          </>
        );

      case EPlatform.WOOCOMMERCE:
        return (
          <>
            <ModalInput label="Shopify Store Domain" placeholder="e.g. my-brand.myshopify.com" value={formData.shopUrl} onChange={(e) => handleChange('shopUrl', e.target.value)} className="font-mono text-sm" />

            <div className="flex gap-3">
              <div className="flex-1">
                <ModalInput label="Consumer Key" placeholder="ck_xxxx..." value={formData.consumerKey} onChange={(e) => handleChange('consumerKey', e.target.value)} className="font-mono text-sm" />
              </div>

              <div className="flex-1">
                <ModalInput label="Consumer Secret" placeholder="cs_xxxx..." value={formData.consumerSecret} onChange={(e) => handleChange('consumerSecret', e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Connect New Store" description="Link an external sales channel to sync inventory." onClose={onClose} />

      <div className="flex flex-col gap-5">
        {/* Common Fields */}
        <ModalInput label="Store Nickname" placeholder="e.g. Main US Store" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} autoFocus />
        <ModalSelect label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as EPlatform)} options={PLATFORM_OPTIONS} />
        <ModalToggle label="Automatic Synchronization" description="If disabled, stock updates won't be pushed to this store." checked={formData.isSyncEnabled} onChange={(checked) => handleChange('isSyncEnabled', checked)} />

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-800"></div>
          </div>

          <div className="relative flex justify-center">
            <span className="bg-slate-900 px-2 text-xs font-medium tracking-widest text-slate-500 uppercase">Credentials</span>
          </div>
        </div>

        {/* Dynamic Fields */}
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-4 duration-300">{renderPlatformFields()}</div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Connect Store" />
    </ModalShell>
  );
};
