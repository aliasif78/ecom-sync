// Database
import Product from '@/database/models/Product';
import { connectDB } from '@/database/mongoose';
import { Types } from 'mongoose';

// Constants
import { DEF_LOC_ID } from '../globalConstants';

// GET Products
// This exists here, only because the component using it is a server component
// If it were a client component, we would use server actions
export async function getProducts() {
  try {
    // 1. Connect to the DB
    await connectDB();

    // 2. Fetch products
    // lean() is 5-10x faster + gives the raw JSON data + returns POJO instead of Mongoose Docs
    // Sort by newest first (standard UX)
    const products = await Product.find().sort({ createdAt: -1 }).lean();

    // 3. Return products
    // Manually serialize ObjectId and Dates - this prevents the "Server to Client" serialization error
    return products.map((product) => ({ ...product, _id: product._id.toString(), createdAt: product.createdAt?.toISOString(), updatedAt: product.updatedAt?.toISOString() }));
  } catch (error) {
    console.error('🚩 GET_PRODUCTS_ERROR:', error);
    return [];
  }
}

export async function addProduct({ userId, name, price, image, sku, stock }: { userId: string; name: string; price: number; image: string; sku: string; stock: number }) {
  try {
    // 1. Safety Check
    if (!userId || !name || !price || !image || !sku || stock === undefined) {
      console.error('🚩 ADD_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    // 2. Connect to the DB
    await connectDB();

    // 3. Inventory Logic (The Ghost Buster 👻🚫)
    // If stock > 0, we MUST assign it to a physical location (Warehouse)
    const inventoryByLocation = stock > 0 ? [{ locationId: DEF_LOC_ID, quantity: stock }] : [];

    // 4. Create product
    await Product.create({ userId: new Types.ObjectId(userId), name, price, image, sku, inventoryByLocation });

    // 5. Return product
    return { success: true, message: 'Product created successfully!' };
  } catch (error) {
    console.error('🚩 ADD_PRODUCT_ERROR:', error);

    // 1. Check for Duplicate Key Error (Mongoose Error Code 11000)
    if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) return { success: false, message: 'This SKU already exists. Please use a unique SKU.' };

    // 2. Generic Error
    return { success: false, message: 'Failed to add product' };
  }
}
