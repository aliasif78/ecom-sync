// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// This is the reasoning layer for Feature 2 (Inventory Anomaly Agent).
// The detectors (lib/anomalies/detectors.ts) have ALREADY decided an anomaly
// exists and computed its exact dataPoints. This file's only job is turning
// those dataPoints into a one-or-two-sentence human-readable explanation.
// The model never sees raw, unfiltered inventory data, and it is never in a
// position to invent an anomaly — its input is a closed list of
// already-confirmed { dedupeKey, type, dataPoints } records.
//
// ⚠️ REUSE, NOT REBUILD:
//   - Model + fallback: `resilientQueryModel` from lib/ai/resilientModel.ts,
//     imported verbatim. It's already model-agnostic (plain
//     wrapLanguageModel(google(...), fallbackMiddleware)) — nothing about it
//     is coupled to the chat route, so no changes were needed there.
//   - Telemetry: instrumentation.ts registers OTel once at server startup,
//     not per-route — any `experimental_telemetry` on ANY generate call in
//     this app (including this one, called from an Inngest step) is picked
//     up automatically. Nothing to change there either.
//
// ⚠️ TELEMETRY FLUSH IS THE CALLER'S RESPONSIBILITY, NOT THIS FILE'S:
// this function doesn't own the process lifecycle it runs in. When called
// from an Inngest step (Phase 4), that step is responsible for flushing the
// Langfuse exporter before the step returns — Inngest invocations are
// short-lived, and a batched OTel exporter that hasn't flushed by the time
// the process exits means the trace silently never reaches Langfuse. Not
// solved here because it's a call-site concern, not a reasoning-layer one.
//
// ⚠️ WHY A DETERMINISTIC FALLBACK, NOT JUST "TRUST THE ZOD SCHEMA":
// The Zod schema passed to Output.object() only guarantees the OUTPUT SHAPE
// is correct (an array of {dedupeKey, reasoning} strings) — it does NOT
// guarantee the CONTENT is correctly attributed. Batching multiple anomalies
// into one call (necessary for cost/latency) means the model could describe
// product A's numbers under product B's dedupeKey, and a shape-only schema
// would never catch that. So every reasoning is checked post-hoc: does the
// anomaly's own identifying string (sku or storeName) actually appear in the
// text the model wrote for that dedupeKey? If not — or if the model dropped
// or invented a dedupeKey entirely — that item falls back to a deterministic,
// template-built sentence assembled directly from dataPoints. This guarantees
// every anomaly gets SOME correct, grounded reasoning, never a null, and
// never a silently misattributed one.
//
// ⚠️ generateObject IS DEPRECATED IN THIS INSTALLED VERSION (ai@6.0.238) —
// VERIFIED against the actual installed .d.ts, not assumed. The correct
// replacement, per that same file's own @deprecated notice, is
// `generateText({ output: Output.object({ schema }) })`, with the parsed
// result on `result.output` — NOT `result.experimental_output`, which is
// itself separately marked deprecated in favor of `.output`. This also
// matches the Output.object() pattern already established in Week 2.

// ==========================================
// 📦 Imports
// ==========================================

import { generateText, Output } from 'ai';
import { z } from 'zod';

import { resilientQueryModel } from '@/lib/ai/resilientModel';
import { ALERT_TYPE, AlertType } from '@/database/models/Alert';

// ==========================================
// 💿 CONSTANTS
// ==========================================

// Anomalies per structured-output call. Kept modest (unlike smartStockout.ts's
// BATCH_SIZE=500) because this task is qualitatively different — that batch
// asked for a simple array of IDs; this asks for distinct, correctly
// attributed prose per item, which degrades with cross-item confusion long
// before 500 items. 20 is a starting assumption, not a measured limit —
// revisit if real batches regularly exceed it.
const REASONING_BATCH_SIZE = 20;

const SYSTEM_PROMPT = `You are an inventory anomaly explainer for an e-commerce operations dashboard.

CRITICAL RULES — YOU ARE NOT A DETECTOR:
1. Every anomaly you are given has ALREADY been confirmed by deterministic code. You are not deciding whether something is an anomaly — it already is. Your only job is to explain, in one or two sentences, why the specific numbers provided constitute a problem.
2. Never mention an anomaly, product, SKU, store, or number that is not present in the input you were given. Do not invent context, causes, or recommendations beyond what the data points literally show.
3. You will be given a list of anomalies, each with a unique "dedupeKey". Your output must contain exactly one reasoning per dedupeKey you were given, and every reasoning must describe ONLY the dataPoints for that specific dedupeKey — never mix numbers from one anomaly into another's explanation.
4. Do not soften, hedge, or add reassurance ("this is likely nothing to worry about") — state the numbers and the concrete implication plainly.
5. Do not speculate about WHY the anomaly happened (e.g. "this may be due to a promotion") unless a cause is explicitly present in the dataPoints — you were not given enough information to know why, only what happened.

Be concise. One or two plain sentences per anomaly, no markdown, no preamble.`;

// ==========================================
// 🚓 TYPES
// ==========================================

export interface ReasoningResult {
  dedupeKey: string;
  reasoning: string;
}

/** The reduced view of an anomaly the model is ever given — deliberately
 * strips userId/productId/storeId/severity, which it has no business
 * seeing or using (per "type + dataPoints only", nothing else crosses this
 * boundary). This is also the exact shape Phase 4's reconcile step has
 * available by the time it calls generateReasoning — full AnomalyCandidate
 * objects don't survive that far, only this. */
export interface ReasoningInput {
  dedupeKey: string;
  type: AlertType;
  dataPoints: Record<string, unknown>;
}

const reasoningOutputSchema = z.object({
  reasonings: z
    .array(
      z.object({
        dedupeKey: z.string(),
        reasoning: z.string().min(1),
      })
    )
    .describe('Exactly one entry per anomaly you were given, matched by dedupeKey.'),
});

// ==========================================
// 🔧 GROUNDING CHECK
// ==========================================

/**
 * Returns every string from `dataPoints` that would legitimately identify
 * this anomaly if it appeared in the reasoning — for product-scoped types,
 * EITHER the sku OR the productName is a correct way to refer to the same
 * anomaly in prose (a model saying "the Acme Widget dropped..." is exactly
 * as grounded as one saying "SKU ACME-01 dropped..."). Checking sku alone
 * was the actual bug behind an early false-fallback-rate scare — see chat.
 */
function getIdentifyingStrings(input: ReasoningInput): string[] {
  const { sku, productName, storeName } = input.dataPoints as { sku?: string; productName?: string; storeName?: string };
  return [sku, productName, storeName].filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/**
 * Cheap, deliberately simple grounding check: does the model's reasoning
 * for this dedupeKey actually mention AT LEAST ONE of the ways this
 * anomaly could legitimately be identified? This will not catch every
 * possible misattribution (a model could mention the right SKU while still
 * describing the wrong numbers), but it reliably catches the most likely
 * failure mode — full cross-item swaps — at near-zero cost. Treat this as
 * a floor, not a guarantee.
 */
function isGrounded(input: ReasoningInput, reasoning: string): boolean {
  const identifiers = getIdentifyingStrings(input);
  if (identifiers.length === 0) return true; // nothing to check against — don't fail closed on a data gap
  const lowerReasoning = reasoning.toLowerCase();
  return identifiers.some((identifier) => lowerReasoning.includes(identifier.toLowerCase()));
}

// ==========================================
// 🔧 DETERMINISTIC FALLBACK
// ==========================================

/**
 * Template-built reasoning, assembled directly from dataPoints with no LLM
 * involvement. Used whenever the model's output for a dedupeKey is missing,
 * invented, or fails the grounding check. Guaranteed correct by
 * construction — every field it references is a field the detector itself
 * produced — at the cost of reading like a template rather than prose.
 */
function buildFallbackReasoning(input: ReasoningInput): string {
  const dp = input.dataPoints as Record<string, unknown>;

  switch (input.type) {
    case ALERT_TYPE.STOCK_DROP:
      return `${dp.sku} dropped from ${dp.oldStock} to ${dp.newStock} units on ${dp.platform} (a ${Math.round(((dp.pctChange as number) ?? 0) * 100)}% decrease).`;

    case ALERT_TYPE.NEGATIVE_STOCK:
      return `${dp.sku} is currently at ${dp.stock} units — a negative stock value, indicating an oversell or data integrity issue.`;

    case ALERT_TYPE.SYNC_DRIFT:
      return `${dp.storeName} (${dp.platform}) has recorded inventory activity as recently as ${dp.mostRecentActivityAt}, but has not synced since ${dp.lastSyncAt ?? 'it was connected'} — approximately ${dp.driftHours} hours of drift.`;

    case ALERT_TYPE.STORE_STATE_CONTRADICTION:
      return `${dp.storeName} (${dp.platform}) is configured to sync (isSyncEnabled: true) but is not currently connected (isConnected: false).`;

    case ALERT_TYPE.STOCKOUT_RISK:
      return `${dp.sku} has ${dp.stock} units left at a sales velocity of ${dp.velocity} units/day — projected to sell out in approximately ${dp.daysRemaining} days.`;

    default:
      // Exhaustiveness guard — if a 6th anomaly type is ever added to the
      // enum without updating this switch, fail loudly here rather than
      // silently returning a useless string.
      throw new Error(`buildFallbackReasoning: no template defined for anomaly type "${input.type}"`);
  }
}

// ==========================================
// 🧠 CORE — ONE BATCH
// ==========================================

async function generateReasoningForBatch(batch: ReasoningInput[]): Promise<ReasoningResult[]> {
  if (batch.length === 0) return [];

  let modelOutputByKey = new Map<string, string>();

  try {
    const { output } = await generateText({
      model: resilientQueryModel,
      output: Output.object({ schema: reasoningOutputSchema }),
      system: SYSTEM_PROMPT,
      prompt: JSON.stringify(batch.map(({ dedupeKey, type, dataPoints }) => ({ dedupeKey, type, dataPoints }))),

      experimental_telemetry: {
        isEnabled: true,
        functionId: 'anomaly-reasoning-agent',
        metadata: { batchSize: batch.length },
      },
    });

    modelOutputByKey = new Map(output.reasonings.map((r) => [r.dedupeKey, r.reasoning]));
  } catch (error) {
    // The whole batch's LLM call failed (both primary and fallback model,
    // per resilientQueryModel's own retry logic, were exhausted). This is
    // NOT fatal to the run — every item in this batch just falls through to
    // its deterministic fallback below, same as an individual grounding
    // failure would. An anomaly missing its LLM-authored prose is a much
    // smaller problem than an anomaly missing an alert entirely.
    console.warn(`⚠️ [ANOMALY_REASONING] generateText (structured output) failed for a batch of ${batch.length} — falling back to deterministic reasoning for all of them.`, error);
  }

  // Reconcile: every input item gets exactly one output, whether that's the
  // model's (grounded) reasoning or the deterministic fallback. This is what
  // guarantees completeness — the model cannot cause an anomaly to end up
  // with no reasoning at all, whether by omitting it, inventing an unrelated
  // key, or failing the grounding check.
  return batch.map((input) => {
    const modelReasoning = modelOutputByKey.get(input.dedupeKey);

    if (modelReasoning && isGrounded(input, modelReasoning)) {
      return { dedupeKey: input.dedupeKey, reasoning: modelReasoning };
    }

    if (modelReasoning) {
      console.warn(`⚠️ [ANOMALY_REASONING] Grounding check failed for dedupeKey "${input.dedupeKey}". Expected one of [${getIdentifyingStrings(input).join(', ')}] to appear. Raw model output was: "${modelReasoning}". Using deterministic fallback instead.`);
    }

    return { dedupeKey: input.dedupeKey, reasoning: buildFallbackReasoning(input) };
  });
}

// ==========================================
// 🚀 EXPORT
// ==========================================

/**
 * Generates reasoning for a list of already-detected anomalies, given only
 * what the model is allowed to see: {dedupeKey, type, dataPoints}. Callers
 * holding full AnomalyCandidate objects (e.g. a standalone test script) can
 * still pass them directly — AnomalyCandidate structurally satisfies
 * ReasoningInput, so no explicit stripping is required at the call site.
 *
 * Batches internally (REASONING_BATCH_SIZE) and runs batches in parallel.
 * Every input is guaranteed exactly one result, in no particular order —
 * callers should key off `dedupeKey`, not array position.
 */
export async function generateReasoning(inputs: ReasoningInput[]): Promise<ReasoningResult[]> {
  if (inputs.length === 0) return [];

  const batches: ReasoningInput[][] = [];
  for (let i = 0; i < inputs.length; i += REASONING_BATCH_SIZE) {
    batches.push(inputs.slice(i, i + REASONING_BATCH_SIZE));
  }

  const batchResults = await Promise.all(batches.map(generateReasoningForBatch));
  return batchResults.flat();
}
