// Constants
import { EPlatform } from '@/lib/globalConstants';

// Components
import { ModalInput, ModalSelect } from '@/components/products/modals/Atoms';

// Types
import { StoreFormState } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformFieldsProps {
  platform: EPlatform;
  /** Holds formData (create) or credentials (edit). */
  data: StoreFormState;
  onChange: (field: string, value: string) => void;
  mode: 'create' | 'edit';
  /**
   * Per-field validation errors keyed by field name.
   * Each `ModalInput` receives its own error slice.
   */
  errors?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the platform-specific credential fields for AddStoreModal /
 * EditStoreModal. Accepts an `errors` map so each field can display its
 * own inline validation message.
 */
export const PlatformFields = ({ platform, data, onChange, mode, errors = {} }: PlatformFieldsProps) => {
  const isEdit = mode === 'edit';

  /**
   * Generates shared props for every credential input.
   * In edit mode the placeholder signals the field is optional.
   */
  const fieldProps = (label: string, placeholder: string) => ({
    label,
    placeholder: isEdit ? 'Leave blank to keep current' : placeholder,
    className: 'font-mono text-sm' as string,
  });

  switch (platform) {
    case EPlatform.SHOPIFY:
      return (
        <>
          <ModalInput {...fieldProps('Store URL', 'e.g. my-brand.myshopify.com')} error={errors.storeUrl} value={data.storeUrl || ''} onChange={(e) => onChange('storeUrl', e.target.value)} />
          <ModalInput {...fieldProps('Access Token', 'shpat_xxxxxxxxxxxxxxxx')} error={errors.accessToken} value={data.accessToken || ''} onChange={(e) => onChange('accessToken', e.target.value)} />
        </>
      );

    case EPlatform.AMAZON:
      return (
        <>
          <ModalInput {...fieldProps('API Key', 'AMZN-MOCK-KEY-...')} error={errors.apiKey} value={data.apiKey || ''} onChange={(e) => onChange('apiKey', e.target.value)} />
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
          <ModalInput {...fieldProps('Store URL', 'https://my-wordpress-site.com')} error={errors.storeUrl} value={data.storeUrl || ''} onChange={(e) => onChange('storeUrl', e.target.value)} />
          <div className="flex gap-3">
            <div className="flex-1">
              <ModalInput {...fieldProps('Consumer Key', 'ck_xxxx...')} error={errors.consumerKey} value={data.consumerKey || ''} onChange={(e) => onChange('consumerKey', e.target.value)} />
            </div>
            <div className="flex-1">
              <ModalInput {...fieldProps('Consumer Secret', 'cs_xxxx...')} error={errors.consumerSecret} value={data.consumerSecret || ''} onChange={(e) => onChange('consumerSecret', e.target.value)} />
            </div>
          </div>
        </>
      );

    default:
      return null;
  }
};
