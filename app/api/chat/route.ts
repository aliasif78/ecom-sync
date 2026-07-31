// Dependencies
import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// Database
import { connectDB } from '@/database/mongoose';
import Product from '@/database/models/Product';

// Inngest
import { inngest } from '@/lib/inngest/client';

// Auth
import { getCurrentUser } from '@/lib/users'; // Check your auth path

// Actions
import { forceSyncAllProducts } from '@/actions/inventory';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // 🛡️ Explicitly check the success of the auth helper
  const authResult = await getCurrentUser();
  if (!authResult.success || !authResult.user) return new Response('Unauthorized', { status: 401 });

  const userId = authResult.user._id.toString();

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),

    // 🧠 UPGRADE 1: The Master Prompt. We literally tell it how to map human intent to tools.
    system: `You are the EcomSync Copilot, an elite AI assistant for e-commerce merchants. 
    You manage inventory and background syncs. 
    
    CRITICAL RULES:
    1. If the user asks for a "summary", "overview", or "how many products I have", DO NOT say you cannot do it. Use the 'getInventoryStatus' tool with sku "all" to fetch the data, then provide a text summary.
    2. If the user asks to update stock, adjust quantities, or sync with a reason, use the 'updateAndSyncStock' tool and pass all provided information.
    3. Be concise, professional, and confident.`,

    messages: await convertToModelMessages(messages),

    tools: {
      getInventoryStatus: {
        // 🧠 UPGRADE 2: Smarter Tool Description so the AI knows WHEN to use it.
        description: 'Fetch inventory data. Use this for specific SKU lookups, OR use sku "all" when the user wants a general summary, report, or overview of their products.',
        inputSchema: z.object({ sku: z.string().describe('The product SKU, or "all" for a full catalog summary.') }),

        execute: async ({ sku }: { sku: string }) => {
          await connectDB();
          let products = [];

          if (sku.toLowerCase() === 'all') products = await Product.find({ userId }).select('name sku stock').limit(50).lean();
          else products = await Product.find({ userId, sku }).select('name sku stock').lean();

          return { products: JSON.parse(JSON.stringify(products)) };
        },
      },

      // 🧠 UPGRADE 3: Renamed and expanded to handle actual data mutation
      updateAndSyncStock: {
        description: 'Update a product\'s stock and trigger a sync. Use sku "all" if the user wants to force sync ALL products. Do NOT ask for a reason if the user did not provide one, just execute the tool immediately.',

        // ✨ THE MAGIC: Expanded Zod schema unlocks new AI capabilities
        inputSchema: z.object({
          sku: z.string().describe('The product SKU to update/sync. Use "all" to sync everything.'),
          newQuantity: z.number().optional().describe('The new stock quantity. Leave undefined if just syncing.'),
          reason: z.string().optional().describe('The reason. Leave undefined if not provided.'),
        }),

        execute: async ({ sku, newQuantity, reason }: { sku: string; newQuantity?: number; reason?: string }) => {
          await connectDB();

          // ⚡ Restore the Fan-Out "Sync All" capability
          if (sku.toLowerCase() === 'all') {
            await forceSyncAllProducts();
            return { success: true, message: 'Force sync dispatched for all products. Watch the UI for updates.' };
          }

          // ... Single SKU Logic
          let targetQuantity = 0;

          // If the user specified a new quantity, update the Master Database FIRST
          if (newQuantity !== undefined) {
            const updatedProduct = await Product.findOneAndUpdate({ sku, userId }, { $set: { stock: newQuantity } }, { new: true }).lean();

            if (!updatedProduct) return { success: false, message: `Failed: SKU ${sku} not found.` };
            targetQuantity = updatedProduct.stock;
          }

          // If they just said "sync", fetch the existing DB stock
          else {
            const product = await Product.findOne({ sku, userId }).select('stock').lean();
            if (!product) return { success: false, message: `Failed: SKU ${sku} not found.` };

            targetQuantity = product.stock;
          }

          // Dispatch to Inngest with the correct quantity and the user's reason
          await inngest.send({ name: 'inventory/stock.updated', data: { sku, quantity: targetQuantity, userId, reason: reason || 'Manual Copilot Sync' } });
          return { success: true, message: `Successfully set ${sku} stock to ${targetQuantity} and dispatched sync. Reason: ${reason || 'None provided'}` };
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
