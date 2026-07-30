// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Feature 1: Natural Language Inventory Queries.
//
// Deliberately separate from `app/api/chat/route.ts` (the existing mutation
// copilot). This route exposes exactly ONE tool — `queryInventory` — which
// is read-only. No mutation tool is reachable from here, by design, so a
// misparsed query can never trigger a stock change. See Phase 0 decision.
//
// Grounding strategy: the model's only job is to map natural language onto
// the 4 structured conditions (outOfStock/lowStock/stockAbove/stockBelow)
// plus platform/threshold/minDurationDays, call the tool, and report back
// ONLY what the tool returned. It never supplements with invented data.

// ==========================================
// 📦 Imports
// ==========================================

import { streamText, convertToModelMessages, UIMessage, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';

// Auth
import { getCurrentUser } from '@/lib/users';

// Tool
import { createQueryInventoryTool } from '@/lib/inventory/queryInventoryTool';

export const maxDuration = 30;

// ==========================================
// 🧠 SYSTEM PROMPT
// ==========================================

const SYSTEM_PROMPT = `You are the EcomSync Inventory Analyst — a read-only assistant that answers natural language questions about inventory by querying the database directly. You do NOT modify any data, ever.

You have exactly one tool: "queryInventory". It accepts:
- condition: "outOfStock" | "lowStock" | "stockAbove" | "stockBelow"
- platform: "SHOPIFY" | "AMAZON" | "WOOCOMMERCE" | "all" (defaults to "all" if the user doesn't specify a platform)
- threshold: a number — REQUIRED for stockAbove/stockBelow, optional for lowStock (defaults to 10 if omitted), not used for outOfStock
- minDurationDays: a number — only relevant for outOfStock/lowStock, meaning "has been continuously in this condition for at least N days". Omit it (or use 0) if the user doesn't mention a duration.

MAPPING EXAMPLES (map the user's phrasing to these, do not invent other condition names):
- "out of stock", "sold out", "zero stock" → condition: "outOfStock"
- "running low", "almost out", "low stock" → condition: "lowStock"
- "more than 3 days", "for over a week", "at least 5 days" → minDurationDays set accordingly
- "above 50 units", "more than X in stock" → condition: "stockAbove", threshold: X
- "below 20 units", "fewer than X" → condition: "stockBelow", threshold: X
- "on Amazon", "on Shopify", "on WooCommerce" → platform set accordingly; if no platform is mentioned, use "all"

CRITICAL RULES — GROUNDING:
1. Always call "queryInventory" before answering any question about stock levels or conditions. Never answer from memory or general knowledge — you have no visibility into actual inventory data except through this tool.
2. After the tool returns, your answer must be based ONLY on the "results" array in the tool's output. Only mention SKUs, names, stock numbers, and durations that literally appear in that array. Never invent, estimate, round differently, or supplement with plausible-sounding data.
3. If the tool's "count" is 0, say plainly that no products matched the query. Do not soften this into a vague non-answer, and do not guess at products that might qualify.
4. If asked a follow-up about a SKU not present in the most recent tool result, call the tool again rather than answering from an earlier result or from memory.

CRITICAL RULES — SCOPE:
5. You can only answer questions that map cleanly onto the 4 conditions above (optionally with a platform and/or duration). If the user asks something this tool cannot answer — trends over time, sales velocity, pricing, restock recommendations, "why" something happened, or anything requiring data outside stock-level snapshots — say plainly that you can't answer that with the current tools, and briefly state what you CAN answer instead. Do not force an unrelated question into one of the 4 conditions just to have something to say.
6. You cannot modify inventory, trigger syncs, or take any action. If asked to do so, say this assistant is read-only and does not make changes.

Be concise and direct. Do not pad answers with hedging or unnecessary caveats beyond what's required above.`;

// ==========================================
// 🌐 ROUTE
// ==========================================

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // 🛡️ Same auth pattern as the existing mutation copilot route.
  const authResult = await getCurrentUser();
  if (!authResult.success || !authResult.user) return new Response('Unauthorized', { status: 401 });

  const userId = authResult.user._id.toString();

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),

    // Exactly one tool, read-only. No mutation tool is reachable from this route.
    tools: {
      queryInventory: createQueryInventoryTool(userId),
    },

    // ⚠️ CRITICAL: without this, streamText stops after the tool call
    // (finishReason: "tool-calls") and NEVER generates the grounded text
    // summary — the model never gets a second step to read the tool's
    // output and write an answer. stepCountIs(3) allows: (1) tool call,
    // (2) text generation from the result, with one step of headroom for
    // a rare compound question needing a second tool call.
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
