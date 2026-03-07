// Constants
import { EPlatform } from '@/lib/globalConstants';

// Components
import { ModalInput, ModalSelect } from '@/components/products/modals/Atoms';

// Types
import { StoreFormState } from '@/types';

// Interfaces
interface PlatformFieldsProps {
  platform: EPlatform;
  data: StoreFormState; // Holds formData or credentials
  onChange: (field: string, value: string) => void;
  mode: 'create' | 'edit';
}

export const PlatformFields = ({ platform, data, onChange, mode }: PlatformFieldsProps) => {
  const isEdit = mode === 'edit';

  // Helper to generate dynamic props based on mode
  const getFieldProps = (label: string, placeholder: string) => ({ label, placeholder: isEdit ? 'Leave blank to keep current' : placeholder, className: 'font-mono text-sm' });

  switch (platform) {
    case EPlatform.SHOPIFY:
      return (
        <>
          <ModalInput {...getFieldProps('Store Url', 'e.g. my-brand.myshopify.com')} value={data.storeUrl || ''} onChange={(e) => onChange('storeUrl', e.target.value)} />
          <ModalInput {...getFieldProps('Access Token', 'shpat_xxxxxxxxxxxxxxxx')} value={data.accessToken || ''} onChange={(e) => onChange('accessToken', e.target.value)} />
        </>
      );

    case EPlatform.AMAZON:
      return (
        <>
          <ModalInput {...getFieldProps('API Key', 'AMZN-MOCK-KEY-...')} value={data.apiKey || ''} onChange={(e) => onChange('apiKey', e.target.value)} />
          <ModalSelect
            label={isEdit ? 'Update Region' : 'Marketplace Region'}
            value={data.endpoint || 'US'}
            onChange={(e) => onChange('endpoint', e.target.value)}
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
          <ModalInput {...getFieldProps('Store URL', 'https://my-wordpress-site.com')} value={data.storeUrl || ''} onChange={(e) => onChange('storeUrl', e.target.value)} />
          <div className="flex gap-3">
            <div className="flex-1">
              <ModalInput {...getFieldProps('Consumer Key', 'ck_xxxx...')} value={data.consumerKey || ''} onChange={(e) => onChange('consumerKey', e.target.value)} />
            </div>
            <div className="flex-1">
              <ModalInput {...getFieldProps('Consumer Secret', 'cs_xxxx...')} value={data.consumerSecret || ''} onChange={(e) => onChange('consumerSecret', e.target.value)} />
            </div>
          </div>
        </>
      );

    default:
      return null;
  }
};
