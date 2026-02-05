// Types
import { ProductRow } from '@/types';

// Interfaces
interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductRow;
}

const EditProductModal = ({ isOpen, onClose, product }: Props) => {
  return (
    <div>
      <h1>asd</h1>
    </div>
  );
};

export default EditProductModal;
