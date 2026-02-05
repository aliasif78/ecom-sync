// React
import { useState } from 'react';

// Shadcn
import { toast } from 'sonner';

// Server Actions
// import { updateProduct } from '@/actions/products'; // You need to create this action

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';

// Types
import { ProductRow } from '@/types';

export default function EditProductModal({ isOpen, onClose, product }: { isOpen: boolean; onClose: () => void; product: ProductRow }) {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: product.name || '', sku: product.sku || '', price: product.price.toString() || '', image: product.image || '' });

  // Functions
  const handleSubmit = async () => {
    // setIsLoading(true);
    // const res = await updateProduct(product._id, form);
    // setIsLoading(false);
    // if (res.success) {
    //   toast.success('Product updated!');
    //   onClose();
    // } else {
    //   toast.error(res.message);
    // }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Edit Product" description="Update product details" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <div className="grid grid-cols-2 gap-4">
          <ModalInput label="SKU" name="sku" value={form.sku} disabled className="cursor-not-allowed opacity-50" suffix="Locked" />
          <ModalInput label="Price" name="price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} suffix="USD" />
        </div>

        <ModalInput label="Image URL" name="image" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Save Changes" />
    </ModalShell>
  );
}
