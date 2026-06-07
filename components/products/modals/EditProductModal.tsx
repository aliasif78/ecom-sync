// React
import { useState } from 'react';

// Server Actions
import { updateProduct } from '@/actions/products';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';
import { ProductImageUpload } from '../ProductImageUpload';

// Shadcn
import { toast } from 'sonner';

// Types
import { ProductRow } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = { name: string; price: string; image: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the Edit Product form client-side.
 * Returns a map of field → error message, or null if all fields are valid.
 */
function validate(form: FormState): FormErrors | null {
  const errs: FormErrors = {};

  if (!form.name.trim()) errs.name = 'Product name is required.';
  if (!form.price) errs.price = 'Price is required.';
  else if (Number(form.price) <= 0) errs.price = 'Price must be greater than 0.';
  if (!form.image) errs.image = 'Please upload a product image.';

  return Object.keys(errs).length ? errs : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for updating an existing product's name, price, and image.
 * All validation is done client-side first; server errors fall back to a toast.
 */
export default function EditProductModal({ isOpen, onClose, product, disallow }: { isOpen: boolean; onClose: () => void; product: ProductRow; disallow?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: product.name || '',
    price: product.price.toString() || '',
    image: product.image || '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  /** Updates a single text field and clears its error. */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  /** Updates the image URL and clears the image error. */
  const handleImageChange = (url: string) => {
    setForm((prev) => ({ ...prev, image: url }));
    setErrors((prev) => ({ ...prev, image: undefined }));
  };

  const handleSubmit = async () => {
    // 1. Client-side validation
    const fieldErrors = validate(form);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }

    // 2. Call server action
    setIsLoading(true);
    try {
      const res = await updateProduct({
        _id: product._id,
        ...form,
        price: Number(form.price),
        disallow,
      });

      if (!res.success) {
        toast.error(res.message || 'Failed to update product.');
        return;
      }

      toast.success('Product updated!');
      onClose();
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Product" description="Update product details" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" value={form.name} onChange={handleChange} error={errors.name} />
        <ModalInput label="Price" name="price" type="number" min={0} value={form.price} onChange={handleChange} suffix="USD" error={errors.price} />

        {/* Image upload — shows its own error below the uploader */}
        <div>
          <ProductImageUpload value={form.image} onChange={handleImageChange} />
          {errors.image && <p className="mt-1.5 text-xs text-red-400">{errors.image}</p>}
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
}
