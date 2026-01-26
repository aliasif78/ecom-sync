// Dependencies
import mongoose from 'mongoose';

// Env
const MONGODB_URI = process.env.MONGODB_URI;

// Global cache
declare global {
  var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

// Cache the instance to prevent making 500+ connections on Next Js's hot reload
let cached = global.mongooseCache;
if (!cached) cached = global.mongooseCache = { conn: null, promise: null };

export const connectDB = async () => {
  // 1. Ensure that MONGODB_URI is available
  if (!MONGODB_URI) throw new Error('MONGODB_URI must be set within .env');

  // 2. Return the cached connection if available
  if (cached.conn) return cached.conn;

  // 3. Create a new connection if not cached
  if (!cached.promise) cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  // 4. Log the connection
  console.log(`Connected to database ${process.env.NODE_ENV} - ${MONGODB_URI}`);

  // 5. Return the connection
  return cached.conn;
};
