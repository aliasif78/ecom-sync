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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormErrors = Partial<Record<'name', string>>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the Edit Store form client-side.
 * Credential fields are optional in edit mode ("leave blank to keep current"),
 * so only the store nickname is required.
 *
 * Returns a map of field → error message, or null if all fields are valid.
 */
function validate(name: string): FormErrors | null {
  const errs: FormErrors = {};
  if (!name.trim()) errs.name = 'Store nickname is required.';
  return Object.keys(errs).length ? errs : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for editing an existing store's nickname, sync toggle, and credentials.
 * Credential fields are optional (blank = keep existing value on the server).
 * All validation is done client-side first; server errors fall back to a toast.
 */
export const EditStoreModal = ({ isOpen, onClose, store }: { isOpen: boolean; onClose: () => void; store: StoreRow }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(store.name || '');
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(store.isSyncEnabled ?? true);
  const [credentials, setCredentials] = useState<Record<string, string>>(store.config || {});
  const [errors, setErrors] = useState<FormErrors>({});

  /** Updates a credential field and clears its error. */
  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // 1. Client-side validation
    const fieldErrors = validate(name);
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

      if (!res.success) {
        toast.error(res.message || 'Failed to update store.');
        return;
      }

      toast.success('Store updated!');
      onClose();
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
          <PlatformFields
            mode="edit"
            platform={store.platform as EPlatform}
            data={credentials}
            onChange={handleCredentialChange}
            // No credential errors in edit mode; fields are all optional
          />
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
};
