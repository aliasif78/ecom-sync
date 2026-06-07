'use client';

// React
import { useState } from 'react';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter, ModalToggle } from '@/components/products/modals/Atoms';
import { PlatformFields } from '@/components/products/modals/PlatformFields';
import Divider from '@/components/products/modals/Divider';

// Types
import { StoreRow } from '@/types';
import { StoreFieldErrors } from '@/lib/stores';

// Constants
import { EPlatform } from '@/lib/globalConstants';

// Server Actions
import { editStoreByIdAction } from '@/actions/stores';

// Shadcn
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Covers both the nickname field and all credential fields for edit mode. */
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
 * Validates the Edit Store form client-side.
 *
 * - The store nickname is always required.
 * - Credential fields are optional ("leave blank to keep current"),
 *   but if filled in, they must pass format checks for their platform.
 *
 * @returns A map of field → error message, or null if all fields are valid.
 */
function validate(name: string, credentials: Record<string, string>, platform: EPlatform): FormErrors | null {
  const errs: FormErrors = {};

  if (!name.trim()) errs.name = 'Store nickname is required.';

  // Only validate credential fields that have been filled in
  if (platform === EPlatform.SHOPIFY || platform === EPlatform.WOOCOMMERCE) {
    const url = credentials.storeUrl?.trim();
    if (url && !isValidUrl(url)) errs.storeUrl = 'Must be a valid URL (e.g. https://mystore.com).';
  }

  if (platform === EPlatform.SHOPIFY) {
    const token = credentials.accessToken?.trim();
    if (token && token.length < 10) errs.accessToken = 'Access token must be at least 10 characters.';
  }

  if (platform === EPlatform.AMAZON) {
    const key = credentials.apiKey?.trim();
    if (key && key.length < 5) errs.apiKey = 'API key must be at least 5 characters.';
  }

  if (platform === EPlatform.WOOCOMMERCE) {
    const ck = credentials.consumerKey?.trim();
    if (ck && !ck.startsWith('ck_')) errs.consumerKey = 'Consumer key must start with "ck_".';

    const cs = credentials.consumerSecret?.trim();
    if (cs && !cs.startsWith('cs_')) errs.consumerSecret = 'Consumer secret must start with "cs_".';
  }

  return Object.keys(errs).length ? errs : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for editing an existing store's nickname, sync toggle, and credentials.
 * Credential fields are optional (blank = keep existing value on the server).
 *
 * Error strategy (two layers):
 *  1. Client-side: format checks on any filled-in credential before network call.
 *  2. Server-side: if the server returns `fieldErrors`, surface them in the form
 *     instead of a generic toast.
 */
export const EditStoreModal = ({ isOpen, onClose, store }: { isOpen: boolean; onClose: () => void; store: StoreRow }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(store.name || '');
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(store.isSyncEnabled ?? true);
  const [credentials, setCredentials] = useState<Record<string, string>>(store.config || {});
  const [errors, setErrors] = useState<FormErrors>({});

  /** Updates a credential field and clears its individual error. */
  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async () => {
    // 1. Client-side validation
    const fieldErrors = validate(name, credentials, store.platform as EPlatform);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }

    // 2. Call server action
    setIsLoading(true);
    try {
      const res = await editStoreByIdAction(store._id, {
        name,
        config: credentials,
        isSyncEnabled,
      });

      if (res.success) {
        toast.success('Store updated!');
        onClose();
      } else if (res.fieldErrors && Object.keys(res.fieldErrors).length > 0) {
        // Surface server-returned field errors directly in the form instead of a toast
        setErrors(res.fieldErrors as FormErrors);
      } else {
        toast.error(res.message || 'Failed to update store.');
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
      <ModalHeader title="Edit Store Connection" description={`Manage settings for ${store.name}`} onClose={onClose} />

      <div className="flex flex-col gap-6">
        {/* Read-only platform badge */}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
          You are editing a <span className="font-bold underline">{store.platform}</span> connection.
        </div>

        {/* General settings */}
        <div className="space-y-4">
          <ModalInput
            label="Store Nickname"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
          />
          <ModalToggle label="Automatic Synchronization" description="Push stock updates to this store." checked={isSyncEnabled} onChange={setIsSyncEnabled} />
        </div>

        {/* Credential rotation — all optional in edit mode */}
        <Divider title="Update Credentials" />

        <div className="animate-in fade-in space-y-4 duration-500">
          <PlatformFields mode="edit" platform={store.platform as EPlatform} data={credentials} onChange={handleCredentialChange} errors={errors} />
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
};
