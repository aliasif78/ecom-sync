'use server';

// Next Js
import { revalidatePath } from 'next/cache';

// BE Functions
import { getCurrentUser } from '@/lib/users';
import { addProductByUserId, deleteProductById, updateProductById } from '@/lib/products';

// ---------------------------------------------------------
// The Generic Wrapper
// ---------------------------------------------------------
async function runProtectedAction(tag: string, fn: (userId: string) => Promise<{ success: boolean; message: string }>, path: string = '/products') {
  try {
    // 1. Centralized Auth
    const { success, user, message } = await getCurrentUser();

    if (!success || !user) {
      console.error(`🚩 ${tag}_ERROR: User not found`);
      return { success: false, message: message || 'Unauthorized' };
    }

    // 2. Execute the Business Logic
    const res = await fn(user._id);

    // 3. Centralized Error Handling
    if (!res.success) {
      console.error(`🚩 ${tag}_ERROR: ${res.message}`);
      return res;
    }

    // 4. Centralized Revalidation
    revalidatePath(path);
    return res;
  } catch (error) {
    console.error(`🚩 ${tag}_CRITICAL_ERROR:`, error);
    return { success: false, message: `Failed to execute ${tag}` };
  }
}

// ---------------------------------------------------------
// 1. Add Product
// ---------------------------------------------------------
export async function addProduct(data: { name: string; price: number; image: string; sku: string; stock: number }) {
  // Unique Input Validation
  if (!data.name || !data.price || !data.image || !data.sku || data.stock === undefined) return { success: false, message: 'Missing required fields' };
  return runProtectedAction('ADD_PRODUCT', (userId) => addProductByUserId({ userId, ...data }));
}

// ---------------------------------------------------------
// 2. Delete Product
// ---------------------------------------------------------
export async function deleteProduct(_id: string) {
  if (!_id) return { success: false, message: 'Missing required fields' };
  return runProtectedAction('DELETE_PRODUCT', (userId) => deleteProductById({ userId, _id }));
}

// ---------------------------------------------------------
// 3. Update Product
// ---------------------------------------------------------
export async function updateProduct(data: { _id: string; name: string; price: number; image: string }) {
  if (!data._id || !data.name || data.price === undefined || !data.image) return { success: false, message: 'Missing required fields' };
  return runProtectedAction('UPDATE_PRODUCT', (userId) => updateProductById({ userId, ...data }));
}
