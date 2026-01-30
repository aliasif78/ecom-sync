// Database
import Product from '@/database/models/Product';
import { connectDB } from '@/database/mongoose';

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
