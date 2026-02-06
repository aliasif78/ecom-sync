// Database
import Product, { IInventoryLevel } from '@/database/models/Product';
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
    return products.map((product) => ({
      ...product,
      _id: product._id.toString(), // Fix ID
      userId: product.userId.toString(), // Fix User ID
      // If you have dates, fix them too:
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
      // Fix nested ObjectIds in inventory
      inventoryByLocation: product.inventoryByLocation?.map((inv: IInventoryLevel) => ({
        ...inv,
        _id: inv._id?.toString(), // Subdocuments have IDs too!
      })),
    }));
  } catch (error) {
    console.error('🚩 GET_PRODUCTS_ERROR:', error);
    return [];
  }
}

export async function verifyProductOwnership(_id: string, userId: string) {
  try {
    // 1. Connect to the DB
    await connectDB();

    // 2. Fetch product
    // ⚡️ SUPER FAST QUERY
    // This only checks the index. It does not load the document.
    const exists = await Product.exists({ _id, userId: new Types.ObjectId(userId) });

    // 3. Return true/false
    // .exists() returns the { _id } object if found, or null if not.
    return !!exists;
  } catch (error) {
    console.error('🚩 VERIFY_PRODUCT_OWNERSHIP_ERROR:', error);
    return false;
  }
}

export async function addProductByUserId({ userId, name, price, image, sku, stock }: { userId: string; name: string; price: number; image: string; sku: string; stock: number }) {
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

export async function updateProductById({ userId, _id, name, price, image }: { userId: string; _id: string; name?: string; price?: number; image?: string }) {
  try {
    // 1. Safety Checks
    if (!userId || !_id || (!name && price === undefined && !image)) {
      console.error('🚩 UPDATE_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    // 2. Connect to the DB
    await connectDB();

    // 3. Build the update data
    const updateData: { name?: string; price?: number; image?: string } = {};
    if (name) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (image) updateData.image = image;

    // 4. Update product
    const updatedProduct = await Product.findOneAndUpdate({ _id, userId: new Types.ObjectId(userId) }, updateData, { new: true, runValidators: true });
    if (!updatedProduct) return { success: false, message: 'Product not found' };

    // 5. Return product
    return { success: true, message: 'Product updated successfully!' };
  } catch (error) {
    console.error('🚩 UPDATE_PRODUCT_ERROR:', error);
    return { success: false, message: 'Failed to update product' };
  }
}

export async function deleteProductById({ _id, userId }: { _id: string; userId: string }) {
  try {
    // 1. Safety Checks
    if (!userId || !_id) {
      console.error('🚩 DELETE_PRODUCT_ERROR: Missing required fields');
      return { success: false, message: 'Missing required fields' };
    }

    // 2. Connect to the DB
    await connectDB();

    // 3. Delete product
    const deletedProduct = await Product.findOneAndDelete({ _id, userId: new Types.ObjectId(userId) });
    if (!deletedProduct) return { success: false, message: 'Product not found' };

    // 4. Return product
    return { success: true, message: 'Product deleted successfully!' };
  } catch (error) {
    console.error('🚩 DELETE_PRODUCT_ERROR:', error);
    return { success: false, message: 'Failed to delete product' };
  }
}
