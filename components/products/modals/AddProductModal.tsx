// React
import { useState } from 'react';

// Server Actions
import { addProduct } from '@/actions/products';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';
import { ProductImageUpload } from '../ProductImageUpload';

// Shadcn
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = {
  name: string;
  sku: string;
  price: string;
  image: string;
  stock: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the Add Product form client-side.
 * Returns a map of field → error message, or null if all fields are valid.
 */
function validate(form: FormState): FormErrors | null {
  const errs: FormErrors = {};

  if (!form.name.trim()) errs.name = 'Product name is required.';
  if (!form.sku.trim()) errs.sku = 'SKU is required.';
  if (!form.price) errs.price = 'Price is required.';
  else if (Number(form.price) <= 0) errs.price = 'Price must be greater than 0.';
  if (!form.image) errs.image = 'Please upload a product image.';
  if (form.stock === '' || Number(form.stock) < 0) errs.stock = 'Stock must be 0 or more.';

  return Object.keys(errs).length ? errs : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for creating a new product SKU in the master catalog.
 * All validation is done client-side first; server errors fall back to a toast.
 */
export default function AddProductModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', sku: '', price: '', image: '', stock: '0' });
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
      const res = await addProduct({
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
      });

      if (!res.success) {
        toast.error(res.message || 'Failed to create product.');
        return;
      }

      toast.success('Product created!');
      onClose();
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Add New Product" description="Create a new SKU in your master catalog" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" placeholder="e.g. Nike Air Max" value={form.name} onChange={handleChange} error={errors.name} />

        <div className="grid grid-cols-2 gap-4">
          <ModalInput label="SKU" name="sku" placeholder="NIKE-AIR-001" value={form.sku} onChange={handleChange} className="uppercase" error={errors.sku} />
          <ModalInput label="Price" name="price" type="number" min={0} value={form.price} onChange={handleChange} suffix="USD" error={errors.price} />
        </div>

        {/* Image upload — shows its own error below the uploader */}
        <div>
          <ProductImageUpload value={form.image} onChange={handleImageChange} />
          {errors.image && <p className="mt-1.5 text-xs text-red-400">{errors.image}</p>}
        </div>

        <ModalInput label="Initial Stock" name="stock" type="number" min={0} value={form.stock} onChange={handleChange} suffix="units" error={errors.stock} />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Create Product" />
    </ModalShell>
  );
}
