// React
import { useState } from 'react';

// Dependencies
import { toast } from 'sonner';

// Server Actions
// import { createProduct } from '@/actions/products'; // You need to create this action

// Components
import { ModalShell, ModalHeader, ModalInput, ModalFooter } from './Atoms';

export default function AddProductModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', price: '', image: '', stock: '0' });

  // Functions
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    if (!form.name || !form.sku || !form.price) return toast.error('Please fill required fields');

    // setIsLoading(true);
    // const res = await createProduct(form); // Server Action
    // setIsLoading(false);

    // if (res.success) {
    //   toast.success('Product created!');
    //   onClose();
    // } else {
    //   toast.error(res.message);
    // }
  };

  return (
    <ModalShell isOpen={isOpen}>
      <ModalHeader title="Add New Product" description="Create a new SKU in your master catalog" onClose={onClose} />

      <div className="space-y-4">
        <ModalInput label="Product Name" name="name" placeholder="e.g. Nike Air Max" value={form.name} onChange={handleChange} />

        <div className="grid grid-cols-2 gap-4">
          <ModalInput label="SKU" name="sku" placeholder="NIKE-AIR-001" value={form.sku} onChange={handleChange} className="uppercase" />
          <ModalInput label="Price" name="price" type="number" prefix="$" value={form.price} onChange={handleChange} suffix="USD" />
        </div>

        <ModalInput label="Image URL" name="image" placeholder="https://..." value={form.image} onChange={handleChange} />
        <ModalInput label="Initial Stock" name="stock" type="number" value={form.stock} onChange={handleChange} suffix="units" />
      </div>

      <ModalFooter onCancel={onClose} onConfirm={handleSubmit} isLoading={isLoading} confirmText="Create Product" />
    </ModalShell>
  );
}
