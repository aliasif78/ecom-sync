// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Tool definition for Feature 1 (Natural Language Inventory Queries).
// This is PURE PLUMBING — no query logic lives here. The model maps natural
// language to these structured params; `queryInventory` (Phase 1) does the
// actual work.
//
// ⚠️ SECURITY: `userId` is deliberately NOT part of the input schema below.
// It is a constructor argument to `createQueryInventoryTool`, closed over
// by `execute`, and always sourced from the authenticated session in the
// route handler — never from the model's tool call arguments. If a model
// could supply its own `userId`, a prompt injection or model error could
// leak another tenant's inventory data. This mirrors the pattern already
// used correctly in the existing `getInventoryStatus` tool.
//
// ⚠️ VALIDATION DESIGN DECISION: `.superRefine()` enforces exactly one rule —
// `threshold` is REQUIRED when condition is `stockAbove`/`stockBelow`. This
// is the case that matters: without it, a missing threshold would silently
// fall through to `undefined` in the DB layer and produce a nonsensical or
// crashing query. Zod rejects this before `queryInventory` is ever called.
//
// We deliberately do NOT reject harmless extraneous fields (e.g. a model
// including `threshold` on an `outOfStock` call) — `queryInventory` already
// ignores irrelevant params per condition, and rejecting on that would just
// cause needless tool-call retries for a field that does no harm.

// ==========================================
// 📦 Imports
// ==========================================

import { z } from 'zod';

import { EPlatform } from '@/lib/globalConstants';
import { queryInventory, QueryInventoryResult } from './queryInventory';

// ==========================================
// 🚓 SCHEMA
// ==========================================

export const queryInventoryInputSchema = z
  .object({
    condition: z.enum(['outOfStock', 'lowStock', 'stockAbove', 'stockBelow']).describe('The inventory condition to filter by. "outOfStock" = stock is exactly 0. "lowStock" = stock is positive but at or below a threshold (defaults to 10 if not specified). "stockAbove"/"stockBelow" = simple threshold comparison, requires "threshold".'),

    platform: z.enum([EPlatform.SHOPIFY, EPlatform.AMAZON, EPlatform.WOOCOMMERCE, 'all']).default('all').describe('Restrict results to products actively listed on this platform. Use "all" (default) for no platform filter.'),

    threshold: z.number().min(0).optional().describe('Required for "stockAbove"/"stockBelow" — the stock quantity to compare against. Optional for "lowStock" (defaults to 10). Ignored for "outOfStock".'),

    minDurationDays: z.number().int().min(0).optional().describe('Only for "outOfStock"/"lowStock" — the minimum number of CONTINUOUS days the product must have been in that condition. Defaults to 0 (no minimum — any duration matches, including products currently in the condition as of just now).'),
  })
  .superRefine((data, ctx) => {
    if ((data.condition === 'stockAbove' || data.condition === 'stockBelow') && data.threshold === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['threshold'],
        message: `"threshold" is required when condition is "${data.condition}".`,
      });
    }
  });

export type QueryInventoryToolInput = z.infer<typeof queryInventoryInputSchema>;

export interface QueryInventoryToolOutput {
  /** Echoes back the resolved params (including any defaults applied, e.g. lowStock threshold=10) so the frontend can display exactly what was queried without re-deriving it. */
  resolvedParams: {
    condition: QueryInventoryToolInput['condition'];
    platform: QueryInventoryToolInput['platform'];
    threshold?: number;
    minDurationDays?: number;
  };
  count: number;
  results: QueryInventoryResult[];
}

// ==========================================
// 🔧 TOOL FACTORY
// ==========================================

/**
 * Builds the `queryInventory` tool definition, scoped to a single
 * authenticated user. Call this once per request inside the route handler,
 * after auth has resolved `userId` — never construct this with a
 * model-supplied or unauthenticated value.
 */
export function createQueryInventoryTool(userId: string) {
  return {
    description: 'Query the inventory database for products matching a specific stock condition. Use this for ANY question about which SKUs/products meet a stock criterion — out of stock, low stock, above/below a threshold — optionally filtered by platform (Shopify/Amazon/WooCommerce) and optionally requiring the condition to have held continuously for a minimum number of days. This is READ-ONLY — it never modifies data.',

    inputSchema: queryInventoryInputSchema,

    execute: async (input: QueryInventoryToolInput): Promise<QueryInventoryToolOutput> => {
      const { condition, platform, threshold, minDurationDays } = input;

      const results = await queryInventory({
        userId,
        condition,
        platform,
        threshold,
        minDurationDays,
      });

      // Resolve the effective threshold actually used (post-default) for accurate echo-back.
      const resolvedThreshold = condition === 'lowStock' ? (threshold ?? 10) : threshold;

      return {
        resolvedParams: {
          condition,
          platform,
          threshold: resolvedThreshold,
          minDurationDays: condition === 'outOfStock' || condition === 'lowStock' ? (minDurationDays ?? 0) : undefined,
        },
        count: results.length,
        results,
      };
    },
  };
}
