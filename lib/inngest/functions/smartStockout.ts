// Inngest
import { inngest } from '../client'; // Adjust path to your Inngest client

// Gemini
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getGeminiPrompt } from '@/lib/geminiPrompt';

// Database
import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';
import InventoryLedger from '@/database/models/InventoryLedger';

// PostHog
import PostHogClient from '@/lib/posthog';

// Gemini Configuration
const GEN_AI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const smartStockoutCheck = inngest.createFunction(
  {
    id: 'smart-stockout-analyzer',
    retries: 3, // If Gemini times out, Inngest will retry up to 3 times automatically
    triggers: [{ cron: 'TZ=UTC 0 3 * * *' }], // Runs every day at 3:00 AM UTC
  },

  async ({ step }) => {
    // 🧮 1: Calculate Velocity (The Math Phase) - we calculate the 14-day rolling average directly in MongoDB.
    await step.run('calculate-sales-velocity', async () => {
      await connectDB();

      // A) Get the date of 14 days ago
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // B) Aggregate history to find total units sold per product
      const velocityData = await InventoryLedger.aggregate([
        // Only match sales (-ve changes), not restocks
        { $match: { createdAt: { $gte: fourteenDaysAgo }, change: { $lt: 0 } } },

        // Group by productId and sum the absolute value of change
        { $group: { _id: '$productId', totalSold: { $sum: { $abs: '$change' } } } },

        // Calculate the daily average
        { $project: { velocity: { $divide: ['$totalSold', 14] } } },
      ]);

      // C) Bulk update products with their new velocity
      if (velocityData.length > 0) {
        // I) Prepare the bulk operations
        const bulkOps = velocityData.map((stat) => ({
          updateOne: {
            // Get the current product
            filter: { _id: stat._id },

            // Update the product
            update: { $set: { recentSalesVelocity: Number(stat.velocity.toFixed(2)) } },
          },
        }));

        // II) Execute them in chunks to avoid the MongoDB 16MB limit
        const chunkSize = 1000;

        for (let i = 0; i < bulkOps.length; i += chunkSize) {
          const chunk = bulkOps.slice(i, i + chunkSize);
          await Product.bulkWrite(chunk);
        }
      }
    });

    // 📦 STEP 2: Fetch Candidates - only fetch products that actually have stock and are moving.
    const candidates = await step.run('fetch-ai-candidates', async () => {
      await connectDB();

      return await Product.find({ isArchived: { $ne: true }, stock: { $gt: 0 }, recentSalesVelocity: { $gt: 0 } })
        .select('_id stock recentSalesVelocity')
        .lean();
    });

    // No products found
    if (!candidates.length) return { message: 'No active moving products to analyze.' };

    // 🧠 STEP 3: Gemini Analysis (The Intelligence Phase)
    const highRiskIds = await step.run('analyze-with-gemini', async () => {
      // A) Set up the model
      const model = GEN_AI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',

        generationConfig: {
          responseMimeType: 'application/json',

          // 🛡️ STRICT SCHEMA: Forces Gemini to return ONLY an array of strings
          responseSchema: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
      });

      // B) Get the prompt - batch AI requests
      const BATCH_SIZE = 500; // Send 500 products at a time
      const aiPromises = [];

      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const prompt = getGeminiPrompt(JSON.stringify(batch));
        aiPromises.push(model.generateContent(prompt));
      }

      // C) Generate & parse the response
      const results = await Promise.all(aiPromises); // Execute all batches in parallel
      return results.flatMap((res) => JSON.parse(res.response.text()) as string[]); // Flatten the resulting arrays into one master list
    });

    // 🎯 STEP 4: State Management & Telemetry
    await step.run('update-database-state', async () => {
      await connectDB();

      // A) RESET: Clear the risk flag for products that are now safe
      const now = new Date();
      await Product.updateMany({ _id: { $nin: highRiskIds }, stockoutRisk: true }, { $set: { stockoutRisk: false, lastRiskAnalysis: now } });

      if (highRiskIds.length > 0) {
        // B) FLAG: Set the risk flag for at-risk products
        await Product.updateMany({ _id: { $in: highRiskIds } }, { $set: { stockoutRisk: true, lastRiskAnalysis: now } });

        // C) TELEMETRY: Log to PostHog War Room
        const ph = PostHogClient();

        highRiskIds.forEach((productId) => {
          ph.capture({ distinctId: 'system_background_job', event: 'SMART_STOCKOUT_FLAGGED', properties: { productId } });
        });

        await ph.shutdown();
      }
    });

    return { analyzed: candidates.length, flagged: highRiskIds.length, flaggedIds: highRiskIds };
  }
);
