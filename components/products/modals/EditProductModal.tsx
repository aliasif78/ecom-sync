// React
import { useState } from 'react';

// Shadcn
import { toast } from 'sonner';

// Server Actions
import { updateProduct } from '@/actions/products';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';

// Types
import { ProductRow } from '@/types';

export default function EditProductModal({ isOpen, onClose, product }: { isOpen: boolean; onClose: () => void; product: ProductRow }) {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: product.name || '', price: product.price.toString() || '', image: product.image || '' });

  // Functions
  const handleSubmit = async () => {
    setIsLoading(true);

    const res = await updateProduct({ _id: product._id, ...form, price: Number(form.price) });
    setIsLoading(false);

    if (res.success) {
      toast.success('Product updated!');
      onClose();
    } else {
      console.error(res.message);
      toast.error(res.message);
    }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Product" description="Update product details" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <ModalInput label="Price" name="price" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} suffix="USD" />
        <ModalInput label="Image URL" name="image" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
}
