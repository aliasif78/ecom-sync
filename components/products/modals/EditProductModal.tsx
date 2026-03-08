// React
import { useState } from 'react';

// Server Actions
import { updateProduct } from '@/actions/products';
import { runServerAction } from '@/lib/utils';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';
import { ProductImageUpload } from '../ProductImageUpload';

// Types
import { ProductRow } from '@/types';

export default function EditProductModal({ isOpen, onClose, product, disallow }: { isOpen: boolean; onClose: () => void; product: ProductRow; disallow?: boolean }) {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: product.name || '', price: product.price.toString() || '', image: product.image || '' });

  // Functions
  const handleSubmit = () => runServerAction({ validate: () => !!(form.name && form.price && form.image), action: () => updateProduct({ _id: product._id, ...form, price: Number(form.price), disallow }), setIsLoading, onSuccess: onClose, successMessage: 'Product updated!' });

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Product" description="Update product details" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <ModalInput label="Price" name="price" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} suffix="USD" />
        <ProductImageUpload value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
}
