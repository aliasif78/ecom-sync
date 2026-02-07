'use client';

// React
import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalSelect, ModalFooter } from '@/components/products/modals/Atoms'; // Adjust path if needed

// Types
// (Ideally import EPlatform from constants, but defining locally for this snippet)
const PLATFORM_OPTIONS = [
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'AMAZON', label: 'Amazon (Mock)' },
  { value: 'WOOCOMMERCE', label: 'WooCommerce' },
];

export const AddStoreModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [platform, setPlatform] = useState('SHOPIFY');

  // We keep a flat state for form inputs for simplicity
  const [formData, setFormData] = useState({
    name: '',
    shopUrl: '',
    accessToken: '',
    apiKey: '',
    endpoint: 'US', // Default for Amazon
    consumerKey: '',
    consumerSecret: '',
  });

  // Handlers
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    // TODO: Construct the specific 'config' object based on platform and call Server Action
    console.log('Submitting:', { platform, ...formData });

    setTimeout(() => {
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  // --- Dynamic Form Logic ---
  const renderPlatformFields = () => {
    switch (platform) {
      case 'SHOPIFY':
        return (
          <>
            <ModalInput label="Shopify Store Domain" placeholder="e.g. my-brand.myshopify.com" value={formData.shopUrl} onChange={(e) => handleChange('shopUrl', e.target.value)} className="font-mono text-sm" />
            <ModalInput label="Admin Access Token" placeholder="shpat_xxxxxxxxxxxxxxxx" value={formData.accessToken} onChange={(e) => handleChange('accessToken', e.target.value)} type="password" className="font-mono text-sm" />
          </>
        );

      case 'AMAZON':
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

      case 'WOOCOMMERCE':
        return (
          <>
            <ModalInput label="Website URL" placeholder="https://my-wordpress-site.com" value={formData.shopUrl} onChange={(e) => handleChange('shopUrl', e.target.value)} className="font-mono text-sm" />
            <div className="flex gap-3">
              <div className="flex-1">
                <ModalInput label="Consumer Key" placeholder="ck_xxxx..." value={formData.consumerKey} onChange={(e) => handleChange('consumerKey', e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="flex-1">
                <ModalInput label="Consumer Secret" placeholder="cs_xxxx..." value={formData.consumerSecret} onChange={(e) => handleChange('consumerSecret', e.target.value)} type="password" className="font-mono text-sm" />
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

        <ModalSelect label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} options={PLATFORM_OPTIONS} />

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
