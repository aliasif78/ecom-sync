'use client';

// React
import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalSelect, ModalFooter, ModalToggle } from '@/components/products/modals/Atoms';
import { PlatformFields } from '@/components/products/modals/PlatformFields';
import Divider from '@/components/products/modals/Divider';

// Shadcn
import { toast } from 'sonner';

// Server Actions
import { addStoreAction } from '@/actions/stores';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// Types
import { StoreFieldErrors } from '@/lib/stores';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_OPTIONS = [
  { value: EPlatform.SHOPIFY, label: 'Shopify' },
  { value: EPlatform.AMAZON, label: 'Amazon (Mock)' },
  { value: EPlatform.WOOCOMMERCE, label: 'WooCommerce' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormData = {
  name: string;
  storeUrl: string;
  accessToken: string;
  apiKey: string;
  endpoint: string;
  consumerKey: string;
  consumerSecret: string;
  isSyncEnabled: boolean;
};

type FormErrors = StoreFieldErrors;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the string is a syntactically valid absolute URL.
 * Uses the native URL constructor so no regex maintenance is needed.
 */
function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the Add Store form client-side before hitting the server.
 * Checks presence, URL format, WooCommerce key prefixes, and token length
 * so most mistakes are caught immediately with field-level messages.
 *
 * @returns A map of field → error message, or null if all fields are valid.
 */
function validate(formData: FormData, platform: EPlatform): FormErrors | null {
  const errs: FormErrors = {};

  if (!formData.name.trim()) errs.name = 'Store nickname is required.';

  if (platform === EPlatform.SHOPIFY) {
    if (!formData.storeUrl.trim()) {
      errs.storeUrl = 'Store URL is required.';
    } else if (!isValidUrl(formData.storeUrl.trim())) {
      errs.storeUrl = 'Must be a valid URL (e.g. https://mystore.myshopify.com).';
    }

    if (!formData.accessToken.trim()) {
      errs.accessToken = 'Access token is required.';
    } else if (formData.accessToken.trim().length < 10) {
      errs.accessToken = 'Access token must be at least 10 characters.';
    }
  } else if (platform === EPlatform.AMAZON) {
    if (!formData.apiKey.trim()) {
      errs.apiKey = 'API key is required.';
    } else if (formData.apiKey.trim().length < 5) {
      errs.apiKey = 'API key must be at least 5 characters.';
    }
  } else if (platform === EPlatform.WOOCOMMERCE) {
    if (!formData.storeUrl.trim()) {
      errs.storeUrl = 'Store URL is required.';
    } else if (!isValidUrl(formData.storeUrl.trim())) {
      errs.storeUrl = 'Must be a valid URL (e.g. https://mystore.com).';
    }

    if (!formData.consumerKey.trim()) {
      errs.consumerKey = 'Consumer key is required.';
    } else if (!formData.consumerKey.trim().startsWith('ck_')) {
      errs.consumerKey = 'Consumer key must start with "ck_".';
    }

    if (!formData.consumerSecret.trim()) {
      errs.consumerSecret = 'Consumer secret is required.';
    } else if (!formData.consumerSecret.trim().startsWith('cs_')) {
      errs.consumerSecret = 'Consumer secret must start with "cs_".';
    }
  }

  return Object.keys(errs).length ? errs : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for connecting a new external sales channel (store) to EcomSync.
 * Platform-specific credential fields are rendered by PlatformFields.
 *
 * Error strategy (two layers):
 *  1. Client-side: URL format, prefix, and length checks before any network call.
 *  2. Server-side: If the server returns `fieldErrors`, surface them in the form
 *     instead of a generic toast, so the user knows exactly what to fix.
 */
export const AddStoreModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [platform, setPlatform] = useState<EPlatform>(EPlatform.SHOPIFY);
  const [errors, setErrors] = useState<FormErrors>({});

  /** Flat form state — easier to manage than nested per-platform objects. */
  const [formData, setFormData] = useState<FormData>({
    name: '',
    storeUrl: '',
    accessToken: '',
    apiKey: '',
    endpoint: 'US',
    consumerKey: '',
    consumerSecret: '',
    isSyncEnabled: true,
  });

  /** Updates any form field and clears its individual error. */
  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  /** Clears all credential errors when the platform changes (fields reset context). */
  const handlePlatformChange = (newPlatform: EPlatform) => {
    setPlatform(newPlatform);
    setErrors({});
  };

  const handleSubmit = async () => {
    // 1. Client-side validation — catches format issues before hitting the network
    const fieldErrors = validate(formData, platform);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }

    // 2. Build the platform-specific config object
    let config: Record<string, unknown> = {};
    if (platform === EPlatform.SHOPIFY) config = { storeUrl: formData.storeUrl, accessToken: formData.accessToken };
    else if (platform === EPlatform.AMAZON) config = { apiKey: formData.apiKey, endpoint: formData.endpoint };
    else if (platform === EPlatform.WOOCOMMERCE)
      config = {
        storeUrl: formData.storeUrl,
        consumerKey: formData.consumerKey,
        consumerSecret: formData.consumerSecret,
      };

    // 3. Call server action
    setIsLoading(true);
    try {
      const result = await addStoreAction({
        name: formData.name,
        platform,
        isSyncEnabled: formData.isSyncEnabled,
        config,
      });

      if (result.success) {
        toast.success(result.message);
        onClose();
      } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        // Surface server-returned field errors directly in the form instead of a toast
        setErrors(result.fieldErrors as FormErrors);
      } else {
        toast.error(result.message || 'Failed to add store.');
      }
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
        {/* Store nickname */}
        <ModalInput label="Store Nickname" placeholder="e.g. Main US Store" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} error={errors.name} autoFocus />

        {/* Platform selector — resets credential errors on change */}
        <ModalSelect label="Platform" value={platform} onChange={(e) => handlePlatformChange(e.target.value as EPlatform)} options={PLATFORM_OPTIONS} />

        <ModalToggle label="Automatic Synchronization" description="Push stock updates to this store." checked={formData.isSyncEnabled} onChange={(c) => handleChange('isSyncEnabled', c)} />

        <Divider title="Credentials" />

        {/* Platform-specific credential fields with per-field errors */}
        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-4 duration-300">
          <PlatformFields mode="create" platform={platform} data={formData} onChange={handleChange} errors={errors} />
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Connect Store" />
    </ModalShell>
  );
};
