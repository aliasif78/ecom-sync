// React
import { useState } from 'react';

// Server Actions
import { addProduct } from '@/actions/products';
import { runServerAction } from '@/lib/utils';

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';
import { ProductImageUpload } from '../ProductImageUpload';

export default function AddProductModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', price: '', image: '', stock: '0' });

  // Functions
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = () => runServerAction({ validate: () => !!(form.name && form.sku && form.price), action: () => addProduct({ ...form, price: Number(form.price), stock: Number(form.stock) }), setIsLoading, onSuccess: onClose, successMessage: 'Product created!' });

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Add New Product" description="Create a new SKU in your master catalog" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" placeholder="e.g. Nike Air Max" value={form.name} onChange={handleChange} />

        <div className="grid grid-cols-2 gap-4">
          <ModalInput label="SKU" name="sku" placeholder="NIKE-AIR-001" value={form.sku} onChange={handleChange} className="uppercase" />
          <ModalInput label="Price" name="price" type="number" prefix="$" value={form.price} onChange={handleChange} suffix="USD" />
        </div>

        <ProductImageUpload value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
        <ModalInput label="Initial Stock" name="stock" type="number" value={form.stock} onChange={handleChange} suffix="units" />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Create Product" />
    </ModalShell>
  );
}
