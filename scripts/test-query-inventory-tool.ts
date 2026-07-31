// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Phase 2 checkpoint. Still no model involved — this calls the tool's
// `execute` function directly with hardcoded args, exactly as the AI SDK
// would after parsing a model's tool call. Two things being verified:
//
//   1. The Zod schema REJECTS invalid combinations (stockAbove/stockBelow
//      with no threshold) — loudly, via safeParse, not silently defaulting.
//   2. Valid calls produce the expected output shape for each of the 4
//      conditions, using the same seeded data from Phase 1.
//
// Run this AFTER seed-query-inventory-test.ts, same userId.
//
// Usage:
//   node -r dotenv/config -r tsx/cjs scripts/test-query-inventory-tool.ts <userId>

import { queryInventoryInputSchema, createQueryInventoryTool } from '@/lib/inventory/queryInventoryTool';
import { EPlatform } from '@/lib/globalConstants';

async function run() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Usage: node -r dotenv/config -r tsx/cjs scripts/test-query-inventory-tool.ts <userId>');
    process.exit(1);
  }

  let allPassed = true;

  // -----------------------------------------------------------------------
  // Part 1 — Schema-level rejection (no DB call, just Zod)
  // -----------------------------------------------------------------------
  console.log('=== SCHEMA VALIDATION ===');

  const invalidCases = [
    { label: 'stockAbove with no threshold', input: { condition: 'stockAbove' } },
    { label: 'stockBelow with no threshold', input: { condition: 'stockBelow', platform: 'all' } },
  ];

  for (const testCase of invalidCases) {
    const result = queryInventoryInputSchema.safeParse(testCase.input);
    const rejected = !result.success;
    console.log(`${testCase.label}: ${rejected ? '✅ REJECTED (correct)' : '❌ ACCEPTED (should have been rejected)'}`);
    if (!result.success) console.log('  →', result.error.issues.map((i) => i.message).join('; '));
    if (!rejected) allPassed = false;
  }

  const validCases = [
    { label: 'outOfStock, no threshold (correctly not required)', input: { condition: 'outOfStock' } },
    { label: 'stockAbove WITH threshold', input: { condition: 'stockAbove', threshold: 20 } },
    { label: 'lowStock, no threshold (optional, defaults to 10)', input: { condition: 'lowStock' } },
  ];

  for (const testCase of validCases) {
    const result = queryInventoryInputSchema.safeParse(testCase.input);
    console.log(`${testCase.label}: ${result.success ? '✅ ACCEPTED (correct)' : '❌ REJECTED (should have been accepted)'}`);
    if (!result.success) {
      console.log('  →', result.error.issues.map((i) => i.message).join('; '));
      allPassed = false;
    }
  }

  // -----------------------------------------------------------------------
  // Part 2 — execute() output shape, against seeded data
  // -----------------------------------------------------------------------
  console.log('\n=== TOOL EXECUTE() OUTPUT SHAPE ===');

  const tool = createQueryInventoryTool(userId);

  const executeCases: { label: string; input: Parameters<typeof tool.execute>[0] }[] = [
    { label: 'outOfStock, amazon, minDurationDays=3', input: { condition: 'outOfStock', platform: EPlatform.AMAZON, minDurationDays: 3 } },
    { label: 'lowStock, platform=all (default threshold)', input: { condition: 'lowStock', platform: 'all' } },
    { label: 'stockAbove, threshold=20', input: { condition: 'stockAbove', platform: 'all', threshold: 20 } },
    { label: 'stockBelow, threshold=5, platform=shopify', input: { condition: 'stockBelow', platform: EPlatform.SHOPIFY, threshold: 5 } },
  ];

  for (const testCase of executeCases) {
    console.log(`\n--- ${testCase.label} ---`);
    const output = await tool.execute(testCase.input);
    console.log(JSON.stringify(output, null, 2));

    const shapeOk = typeof output.count === 'number' && Array.isArray(output.results) && typeof output.resolvedParams === 'object' && output.count === output.results.length;

    console.log(shapeOk ? '✅ shape OK' : '❌ shape mismatch');
    if (!shapeOk) allPassed = false;
  }

  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED — do not proceed to Phase 3 until fixed'}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('❌ Test script crashed:', err);
  process.exit(1);
});
