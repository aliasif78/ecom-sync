// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Phase 2 checkpoint. Calls each detector directly against the data from
// seed-anomaly-test.ts and asserts:
//   1. Every expected SKU/store appears, with the correct severity.
//   2. Every "should NOT trigger" SKU/store does NOT appear.
// This runs BEFORE any Inngest wiring or LLM call — pure detector-layer
// verification, same discipline as test-query-inventory-tool.ts.
//
// Usage:
//   node -r dotenv/config -r tsx/cjs scripts/test-anomaly-detectors.ts <userId>

import { detectStockDrops, detectNegativeStock, detectSyncDrift, detectStoreStateContradictions, detectStockoutRisk, AnomalyCandidate } from '@/lib/anomalies/detectors';
import { ALERT_SEVERITY } from '@/database/models/Alert';

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Usage: node -r dotenv/config -r tsx/cjs scripts/test-anomaly-detectors.ts <userId>');
    process.exit(1);
  }

  let allPassed = true;

  function assertPresent(label: string, candidates: AnomalyCandidate[], matchFn: (c: AnomalyCandidate) => boolean, expectedSeverity: string) {
    const match = candidates.find(matchFn);
    if (!match) {
      console.log(`❌ ${label}: NOT FOUND (expected to trigger)`);
      allPassed = false;
      return;
    }
    if (match.severity !== expectedSeverity) {
      console.log(`❌ ${label}: found, but severity was ${match.severity} (expected ${expectedSeverity})`);
      allPassed = false;
      return;
    }
    console.log(`✅ ${label}: found with severity ${match.severity}`);
  }

  function assertAbsent(label: string, candidates: AnomalyCandidate[], matchFn: (c: AnomalyCandidate) => boolean) {
    const match = candidates.find(matchFn);
    if (match) {
      console.log(`❌ ${label}: FOUND (expected NOT to trigger) — severity ${match.severity}, dataPoints ${JSON.stringify(match.dataPoints)}`);
      allPassed = false;
      return;
    }
    console.log(`✅ ${label}: correctly absent`);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== STOCK DROP ===');
  const stockDrops = await detectStockDrops();
  assertPresent('ANOM-DROP-MED (65% drop)', stockDrops, (c) => c.dataPoints.sku === 'ANOM-DROP-MED', ALERT_SEVERITY.MEDIUM);
  assertPresent('ANOM-DROP-HIGH (90% drop)', stockDrops, (c) => c.dataPoints.sku === 'ANOM-DROP-HIGH', ALERT_SEVERITY.HIGH);
  assertAbsent('ANOM-DROP-NONE (0.5% drop, below threshold)', stockDrops, (c) => c.dataPoints.sku === 'ANOM-DROP-NONE');
  assertAbsent('ANOM-DROP-STALE (90% drop, outside 24h window)', stockDrops, (c) => c.dataPoints.sku === 'ANOM-DROP-STALE');

  // -----------------------------------------------------------------------
  console.log('\n=== NEGATIVE STOCK ===');
  const negativeStock = await detectNegativeStock();
  assertPresent('ANOM-NEG-MED (-5)', negativeStock, (c) => c.dataPoints.sku === 'ANOM-NEG-MED', ALERT_SEVERITY.MEDIUM);
  assertPresent('ANOM-NEG-HIGH (-15)', negativeStock, (c) => c.dataPoints.sku === 'ANOM-NEG-HIGH', ALERT_SEVERITY.HIGH);
  assertAbsent('ANOM-NEG-NONE (0, not negative)', negativeStock, (c) => c.dataPoints.sku === 'ANOM-NEG-NONE');

  // -----------------------------------------------------------------------
  console.log('\n=== SYNC DRIFT ===');
  const syncDrift = await detectSyncDrift();
  assertPresent('Store "Medium Drift" (24h drift)', syncDrift, (c) => c.dataPoints.storeName === 'Anomaly Test Store: Medium Drift', ALERT_SEVERITY.MEDIUM);
  assertAbsent('Store "No Drift" (synced recently)', syncDrift, (c) => c.dataPoints.storeName === 'Anomaly Test Store: No Drift');

  // -----------------------------------------------------------------------
  console.log('\n=== STORE STATE CONTRADICTION ===');
  const storeContradictions = await detectStoreStateContradictions();
  assertPresent('Store "Contradiction" (enabled but disconnected)', storeContradictions, (c) => c.dataPoints.storeName === 'Anomaly Test Store: Contradiction', ALERT_SEVERITY.HIGH);
  assertAbsent('Store "Intentionally Disabled" (disabled + disconnected)', storeContradictions, (c) => c.dataPoints.storeName === 'Anomaly Test Store: Intentionally Disabled');

  // -----------------------------------------------------------------------
  console.log('\n=== STOCKOUT RISK ===');
  const stockoutRisk = await detectStockoutRisk();
  assertPresent('ANOM-RISK-HIGH (~0.48 days remaining)', stockoutRisk, (c) => c.dataPoints.sku === 'ANOM-RISK-HIGH', ALERT_SEVERITY.HIGH);
  assertAbsent('ANOM-RISK-NONE (50 days remaining)', stockoutRisk, (c) => c.dataPoints.sku === 'ANOM-RISK-NONE');
  assertAbsent('ANOM-RISK-SINGLE-ORDER (same math as ANOM-RISK-HIGH, but only 1 order)', stockoutRisk, (c) => c.dataPoints.sku === 'ANOM-RISK-SINGLE-ORDER');

  // -----------------------------------------------------------------------
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED — see above'}`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Test script failed:', err);
  process.exit(1);
});
