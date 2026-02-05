'use server';

// Next Js
import { revalidatePath } from 'next/cache';

// BE Functions
import { getCurrentUser } from '@/lib/users';
import { addProductByUserId } from '@/lib/products';

export async function addProduct({ name, price, image, sku, stock }: { name: string; price: number; image: string; sku: string; stock: number }) {
  try {
    // 1. Safety Checks
    if (!name || !price || !image || !sku || stock === undefined) {
      console.error('🚩 ADD_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    // 2. Get current user
    const { success, user, message } = await getCurrentUser();

    if (!success) {
      console.error('🚩 ADD_PRODUCT_ERROR: User not found');
      return { success: false, message };
    }

    // 3. Add product
    const res = await addProductByUserId({ userId: user._id, name, price, image, sku, stock });

    if (!res.success) {
      console.error('🚩 ADD_PRODUCT_ERROR: Failed to add product');
      return { success: false, message: res.message };
    }

    // 4. Tell Next Js to refetch the products
    revalidatePath('/products');

    // 5. Return result
    return { success: true, message: 'Product added successfully!' };
  } catch (error) {
    console.error('🚩 ADD_PRODUCT_ERROR:', error);
    return { success: false, message: 'Failed to add product' };
  }
}
