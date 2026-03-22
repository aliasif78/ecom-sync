'use server';

// BE Functions
import { addProductByUserId, deleteProductById, updateProductById } from '@/lib/products';

// Redis
import { withDistributedLock } from '@/lib/redis/lock';

// Auth
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

  // 1. Auth Guard: The Bouncer. Only authenticated users get to talk to Redis.
  return authGuard('DELETE_PRODUCT', '/products', async (userId) => {
    // 2. Redis Lock: The Traffic Cop. We lock using the SKU.
    // If a user double-clicks the "Add" button, the second click waits or fails here.
    return await withDistributedLock(_id, async () => {
      // 3. Internal Plumbing: Safe, isolated, and guaranteed to be single-threaded for this SKU.
      return await deleteProductById({ userId, _id });
    });
  });
}

// ---------------------------------------------------------
// 3. Update Product
// ---------------------------------------------------------
export async function updateProduct(data: { _id: string; name: string; price: number; image: string; disallow?: boolean }) {
  if (data.disallow) return { success: false, message: 'You are not allowed to update this product in its current state' };
  if (!data._id || !data.name || data.price === undefined || !data.image) return { success: false, message: 'Missing required fields' };

  return authGuard('UPDATE_PRODUCT', '/products', async (userId) => {
    return await withDistributedLock(data._id, async () => {
      return await updateProductById({ userId, ...data });
    });
  });
}
