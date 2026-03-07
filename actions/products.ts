'use server';

// BE Functions
import { addProductByUserId, deleteProductById, updateProductById } from '@/lib/products';
import { authGuard } from '@/lib/safe-action';

// ---------------------------------------------------------
// 1. Add Product
// ---------------------------------------------------------
export async function addProduct(data: { name: string; price: number; image: string; sku: string; stock: number }) {
  // Unique Input Validation
  if (!data.name || !data.price || !data.image || !data.sku || data.stock === undefined) return { success: false, message: 'Missing required fields' };
  return authGuard('ADD_PRODUCT', '/products', (userId) => addProductByUserId({ userId, ...data }));
}

// ---------------------------------------------------------
// 2. Delete Product
// ---------------------------------------------------------
export async function deleteProduct(_id: string, disallow?: boolean) {
  if (disallow) return { success: false, message: 'You are not allowed to delete this product in its current state' };
  if (!_id) return { success: false, message: 'Missing required fields' };
  return authGuard('DELETE_PRODUCT', '/products', (userId) => deleteProductById({ userId, _id }));
}

// ---------------------------------------------------------
// 3. Update Product
// ---------------------------------------------------------
export async function updateProduct(data: { _id: string; name: string; price: number; image: string; disallow?: boolean }) {
  if (data.disallow) return { success: false, message: 'You are not allowed to update this product in its current state' };
  if (!data._id || !data.name || data.price === undefined || !data.image) return { success: false, message: 'Missing required fields' };
  return authGuard('UPDATE_PRODUCT', '/products', (userId) => updateProductById({ userId, ...data }));
}
