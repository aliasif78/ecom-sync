// Dependencies
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';

// Database
import Product, { IProduct, SYNC_STATUS } from '../database/models/Product';

// Load env vars
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

const LOCATIONS = ['WAREHOUSE_NY', 'WAREHOUSE_LA', 'STORE_CHI'];

const generateProduct = (): Partial<IProduct> => {
  const name = faker.commerce.productName();
  // SKU: LOGITECH-KEYBOARD-A1B2
  const sku = faker.helpers.slugify(name).toUpperCase() + '-' + faker.string.alphanumeric(4).toUpperCase();

  // Randomly distribute stock
  const inventoryByLocation = faker.helpers.arrayElements(LOCATIONS, { min: 1, max: 3 }).map((loc) => ({ locationId: loc, quantity: faker.number.int({ min: 0, max: 100 }) }));

  // Weighted random status
  const syncScenario = faker.helpers.weightedArrayElement([
    { weight: 70, value: SYNC_STATUS.IDLE },
    { weight: 20, value: SYNC_STATUS.SYNCING },
    { weight: 10, value: SYNC_STATUS.FAILED },
  ]);

  // Stock is auto-calculated by Pre-Save Hook
  return { sku, name, price: parseFloat(faker.commerce.price()), image: faker.image.urlLoremFlickr({ category: 'tech' }), mappings: { shopify: { productId: faker.string.numeric(10), variantId: faker.string.numeric(10) }, amazon: { asin: faker.string.alphanumeric(10).toUpperCase(), fulfillmentSku: sku, syncStatus: syncScenario, lastSyncError: syncScenario === SYNC_STATUS.FAILED ? 'Rate Limit Exceeded: Amazon API 429' : undefined }, woocommerce: { remoteId: faker.string.numeric(5) } }, inventoryByLocation };
};

async function seed() {
  console.log('🌱 Starting Seed...');

  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB Atlas');

    // 1. Clean DB
    await Product.deleteMany({});
    console.log('🧹 Cleared existing products');

    // 2. Generate
    const products = Array.from({ length: 50 }).map(() => generateProduct());

    // 3. Insert
    console.log('🚀 Inserting 50 products...');
    for (const p of products) {
      const doc = new Product(p);
      await doc.save();
    }

    console.log('✅ Seed Complete!');
    process.exit(0);
  } catch (error) {
    console.error('⛔️ Seed Failed:', error);
    process.exit(1);
  }
}

seed();
