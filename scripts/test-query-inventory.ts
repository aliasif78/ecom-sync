// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Standalone verification script — calls `queryInventory` directly with
// hardcoded params matching the scenarios seeded by
// scripts/seed-query-inventory-test.ts. Run this AFTER the seed script,
// against the SAME userId, and manually compare actual output to the
// expected outcomes printed at the end.
//
// This deliberately does NOT touch the AI/tool-calling layer — the goal is
// to prove the query logic itself is correct before an LLM is anywhere
// near it. If a case fails here, fix it here before moving to Phase 2.
//
// Usage:
//   tsx scripts/test-query-inventory.ts <userId>

import { queryInventory } from '@/lib/inventory/queryInventory';
import { EPlatform } from '@/lib/globalConstants';

async function run() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Usage: tsx scripts/test-query-inventory.ts <userId>');
    process.exit(1);
  }

  const cases: { label: string; params: Parameters<typeof queryInventory>[0]; expectSkus: string[] }[] = [
    {
      label: 'outOfStock, amazon, minDurationDays=3 (the example query from the plan)',
      params: { userId, condition: 'outOfStock', platform: EPlatform.AMAZON, minDurationDays: 3 },
      expectSkus: ['TEST-A'], // B=1d, C=1d(relapse) should both be excluded
    },
    {
      label: 'outOfStock, amazon, minDurationDays=0 (no minimum — everything out of stock on Amazon)',
      params: { userId, condition: 'outOfStock', platform: EPlatform.AMAZON, minDurationDays: 0 },
      expectSkus: ['TEST-A', 'TEST-B', 'TEST-C'],
    },
    {
      label: 'outOfStock, platform=all, minDurationDays=3',
      params: { userId, condition: 'outOfStock', platform: 'all', minDurationDays: 3 },
      expectSkus: ['TEST-A'],
    },
    {
      label: 'lowStock, platform=all, default threshold (10)',
      params: { userId, condition: 'lowStock', platform: 'all' },
      expectSkus: ['TEST-D'], // stock=3, <10
    },
    {
      label: 'lowStock, platform=amazon, default threshold — TEST-D excluded (Shopify only)',
      params: { userId, condition: 'lowStock', platform: EPlatform.AMAZON },
      expectSkus: [], // A/B/C are 0 stock, not "low" (>0 && <=threshold); D isn't Amazon-mapped
    },
    {
      label: 'stockAbove, threshold=20',
      params: { userId, condition: 'stockAbove', threshold: 20 },
      expectSkus: ['TEST-E'],
    },
    {
      label: 'stockBelow, threshold=5',
      params: { userId, condition: 'stockBelow', threshold: 5 },
      expectSkus: ['TEST-A', 'TEST-B', 'TEST-C', 'TEST-D'], // all at 0 or 3, all < 5
    },
    {
      label: 'stockBelow, threshold=5, platform=shopify — only TEST-D is Shopify-mapped',
      params: { userId, condition: 'stockBelow', threshold: 5, platform: EPlatform.SHOPIFY },
      expectSkus: ['TEST-D'],
    },
  ];

  let allPassed = true;

  for (const testCase of cases) {
    console.log(`\n--- ${testCase.label} ---`);
    console.log('params:', testCase.params);

    const results = await queryInventory(testCase.params);
    const actualSkus = results
      .map((r) => r.sku)
      .filter((sku) => sku.startsWith('TEST-'))
      .sort();
    const expectedSkus = [...testCase.expectSkus].sort();
    const passed = JSON.stringify(actualSkus) === JSON.stringify(expectedSkus);

    console.log('results:', results);
    console.log(`expected SKUs: [${expectedSkus.join(', ')}]`);
    console.log(`actual SKUs:   [${actualSkus.join(', ')}]`);
    console.log(passed ? '✅ PASS' : '❌ FAIL');

    if (!passed) allPassed = false;
  }

  console.log(`\n${allPassed ? '✅ ALL CASES PASSED' : '❌ SOME CASES FAILED — do not proceed to Phase 2 until fixed'}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('❌ Test script crashed:', err);
  process.exit(1);
});
