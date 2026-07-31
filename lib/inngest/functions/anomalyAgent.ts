// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// This is the orchestration layer for Feature 2 (Inventory Anomaly Agent),
// replacing lib/inngest/functions/smartStockout.ts (removed in Phase 5).
//
// ⚠️ STOCK_DROP NEVER AUTO-RESOLVES — READ BEFORE TOUCHING THE RECONCILE LOOP:
// STOCK_DROP's dedupeKey is tied to a specific ledger entry, and its detector
// only looks back 24h (see detectors.ts). That means every stock-drop alert
// naturally falls OUT of detectStockDrops's output within 24h — not because
// the problem was fixed, but because it aged out of the lookback window.
// If "no longer detected this run" were treated as "resolved" for every
// type uniformly, every stock-drop alert would silently auto-close within
// ~24h (at most 4 cron cycles) regardless of whether anyone ever saw it —
// exactly backwards for what an alert is for. Auto-resolve is applied ONLY
// to the four ongoing-condition types (NEGATIVE_STOCK, SYNC_DRIFT,
// STORE_STATE_CONTRADICTION, STOCKOUT_RISK), where "no longer detected"
// genuinely means the condition is no longer true. STOCK_DROP alerts stay
// OPEN until a human dismisses them — see ONGOING_CONDITION_TYPES below.
//
// ⚠️ PER-DETECTOR FAULT ISOLATION IS DONE VIA INLINE try/catch, NOT
// INNGEST'S onFailure: Inngest's function-level `onFailure` only fires once,
// after the ENTIRE run's retries are exhausted — it does not let 4 detector
// steps keep running if a 5th's retries are exhausted. To get the isolation
// this feature actually needs (one bad Mongo query shouldn't block the other
// 4 detectors from writing alerts), each detector step is individually
// wrapped in try/catch in the handler below. A function-level onFailure is
// ALSO registered as a last-resort logger for failures outside those steps
// (e.g. reconcile itself exhausting retries), not as the isolation mechanism.
//
// ⚠️ SERIALIZATION ACROSS STEP BOUNDARIES: Inngest persists step return
// values as JSON. AnomalyCandidate.userId/productId/storeId are Mongoose
// ObjectIds, which do not survive that round-trip cleanly — every detector
// step below explicitly converts them to strings before returning (see
// serializeCandidate). Similarly, any `Date` inside `dataPoints` (e.g.
// `occurredAt`) comes back as an ISO string in every step AFTER the one that
// produced it — this is fine, nothing downstream needs a real Date instance,
// but worth knowing if you extend this file.
//
// ⚠️ RECONCILE MUST BE IDEMPOTENT: if this step's retries are exhausted and
// Inngest retries it, the ENTIRE step body re-runs (Inngest replays a failed
// step's full body, not sub-portions of it). Upsert-by-dedupeKey and the
// set-based resolve query are both safe to run twice — re-running produces
// the same end state, not duplicates. This is a load-bearing property, not
// an accident.
//
// ⚠️ DISMISS-REOPEN, NOT DUPLICATE: if a candidate's dedupeKey matches a
// DISMISSED alert (not an OPEN one), the reconcile step reopens that SAME
// document rather than creating a second one. Without this, dismissing an
// alert whose underlying condition persists would silently produce a new
// document every 6 hours with the same dedupeKey — technically allowed by
// the partial unique index (which only constrains OPEN), but not what
// "dismiss" should mean. Decided explicitly after Phase 6, not by default.
//
// ⚠️ JSON.stringify-BASED CHANGE DETECTION IS A HEURISTIC, NOT A RIGOROUS
// DEEP-EQUAL: comparing existing.dataPoints to a freshly computed candidate's
// dataPoints via JSON.stringify only works reliably because both are always
// constructed by the exact same code path (serializeCandidate → the same
// field order every time). It is not a general-purpose deep-equal. If
// dataPoints construction order ever becomes non-deterministic, swap this
// for a real deep-equal utility.

// ==========================================
// 📦 Imports
// ==========================================

import { trace } from '@opentelemetry/api';

import { inngest } from '../client';
import { connectDB } from '@/database/mongoose';
import Alert, { ALERT_TYPE, ALERT_STATUS, AlertType, AlertSeverity } from '@/database/models/Alert';
import { detectStockDrops, detectNegativeStock, detectSyncDrift, detectStoreStateContradictions, detectStockoutRisk, AnomalyCandidate } from '@/lib/anomalies/detectors';
import { generateReasoning, ReasoningInput } from '@/lib/anomalies/generateReasoning';
import PostHogClient from '@/lib/posthog';

// ==========================================
// 💿 CONSTANTS
// ==========================================

// See CONTEXT above for why this split exists and what it protects against.
const ONGOING_CONDITION_TYPES: AlertType[] = [ALERT_TYPE.NEGATIVE_STOCK, ALERT_TYPE.SYNC_DRIFT, ALERT_TYPE.STORE_STATE_CONTRADICTION, ALERT_TYPE.STOCKOUT_RISK];

const POSTHOG_EVENT_ALERT_CREATED = 'ANOMALY_ALERT_CREATED';
const POSTHOG_EVENT_ALERT_REOPENED = 'ANOMALY_ALERT_REOPENED';

// ==========================================
// 🚓 TYPES
// ==========================================

/** JSON-safe version of AnomalyCandidate — what actually crosses an Inngest
 * step boundary. See "SERIALIZATION ACROSS STEP BOUNDARIES" above. */
interface SerializedCandidate {
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  productId?: string;
  storeId?: string;
  dataPoints: Record<string, unknown>;
  dedupeKey: string;
}

function serializeCandidate(candidate: AnomalyCandidate): SerializedCandidate {
  return {
    userId: candidate.userId.toString(),
    type: candidate.type,
    severity: candidate.severity,
    productId: candidate.productId?.toString(),
    storeId: candidate.storeId?.toString(),
    dataPoints: candidate.dataPoints,
    dedupeKey: candidate.dedupeKey,
  };
}

interface NewAlertEvent {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  productId?: string;
  storeId?: string;
  dedupeKey: string;
}

interface ReconcileResult {
  needsReasoning: (ReasoningInput & { alertId: string })[];
  newAlerts: NewAlertEvent[];
  reopenedAlerts: NewAlertEvent[];
}

// ==========================================
// 🔧 TELEMETRY FLUSH — best effort, see CONTEXT above
// ==========================================

/**
 * Attempts to force-flush the globally registered OpenTelemetry tracer
 * provider before this short-lived Inngest step exits. Duck-typed (checks
 * for a `.forceFlush` method at runtime) rather than importing a specific
 * SDK type, matching the same pragmatic approach as
 * lib/ai/resilientModel.ts's getStatusCode — this avoids depending on
 * knowing the exact provider class your installed @vercel/otel version
 * constructs internally.
 *
 * ⚠️ VERIFY THIS ACTUALLY WORKS against your installed versions by checking
 * the Langfuse dashboard after a real run — this is a best-effort
 * implementation, not a guaranteed one. If `@opentelemetry/api` fails to
 * resolve as an import, install it directly: it's a dependency
 * @vercel/otel already relies on, so it should be version-compatible.
 */
async function flushTelemetry(): Promise<void> {
  const provider = trace.getTracerProvider();
  const maybeFlushable = provider as unknown as { forceFlush?: () => Promise<void> };

  if (typeof maybeFlushable.forceFlush === 'function') {
    await maybeFlushable.forceFlush();
    console.log('✅ [TELEMETRY] forceFlush() called on tracer provider.');
    return;
  }

  console.warn('⚠️ [TELEMETRY] Tracer provider does not expose forceFlush() — could not confirm traces were flushed before this step exits. Verify against the Langfuse dashboard.');
}

// ==========================================
// 🧠 FUNCTION
// ==========================================

export const anomalyAgent = inngest.createFunction(
  {
    id: 'inventory-anomaly-agent',
    retries: 3,
    triggers: [{ cron: 'TZ=UTC 0 */6 * * *' }], // Every 6 hours, per Phase 4 plan

    // Last-resort logger only — NOT the per-detector isolation mechanism.
    // See "PER-DETECTOR FAULT ISOLATION" in CONTEXT above for why isolation
    // is implemented via inline try/catch around each detector step instead.
    onFailure: async ({ error }) => {
      console.error('🚩 [ANOMALY_AGENT] Function-level failure after exhausting retries — some steps beyond the per-detector try/catch below did not complete.', error);
    },
  },

  async ({ step }) => {
    // ------------------------------------------------------------------
    // STEP GROUP 1 — Detection. Each detector is its own step (so Inngest
    // can retry/memoize them independently), wrapped in try/catch so one
    // detector exhausting its retries doesn't stop the others from running.
    // connectDB() is already called inside each detector function itself
    // (see detectors.ts) — no separate "connect" step needed.
    // ------------------------------------------------------------------

    async function runDetectorStep(stepId: string, detectorFn: () => Promise<AnomalyCandidate[]>): Promise<SerializedCandidate[]> {
      try {
        return await step.run(stepId, async () => (await detectorFn()).map(serializeCandidate));
      } catch (error) {
        console.error(`🚩 [ANOMALY_AGENT] Detector step "${stepId}" failed after exhausting its retries — continuing the run with 0 candidates from this detector. Other detectors are unaffected.`, error);
        return [];
      }
    }

    const stockDrops = await runDetectorStep('detect-stock-drops', detectStockDrops);
    const negativeStock = await runDetectorStep('detect-negative-stock', detectNegativeStock);
    const syncDrift = await runDetectorStep('detect-sync-drift', detectSyncDrift);
    const storeStateContradictions = await runDetectorStep('detect-store-state-contradictions', detectStoreStateContradictions);
    const stockoutRisk = await runDetectorStep('detect-stockout-risk', detectStockoutRisk);

    const candidatesByType: Record<AlertType, SerializedCandidate[]> = {
      [ALERT_TYPE.STOCK_DROP]: stockDrops,
      [ALERT_TYPE.NEGATIVE_STOCK]: negativeStock,
      [ALERT_TYPE.SYNC_DRIFT]: syncDrift,
      [ALERT_TYPE.STORE_STATE_CONTRADICTION]: storeStateContradictions,
      [ALERT_TYPE.STOCKOUT_RISK]: stockoutRisk,
    };

    // ------------------------------------------------------------------
    // STEP GROUP 2 — Reconcile. Upsert by dedupeKey, refresh dataPoints/
    // severity for ongoing-condition types, auto-resolve stale ongoing-
    // condition alerts (STOCK_DROP deliberately excluded — see CONTEXT).
    //
    // ⚠️ Sequential per-candidate DB round-trips (find, then create/save) —
    // a known N+1-style limitation, acceptable at this feature's actual
    // scale (dozens of alerts per run), same tradeoff class as the N+1
    // pattern already documented in queryInventory.ts. At high alert
    // volume this should become real bulk upsert operations.
    // ------------------------------------------------------------------

    const reconcileResult: ReconcileResult = await step.run('reconcile-alerts', async () => {
      await connectDB();

      const needsReasoning: (ReasoningInput & { alertId: string })[] = [];
      const newAlerts: NewAlertEvent[] = [];
      const reopenedAlerts: NewAlertEvent[] = [];

      for (const type of Object.values(ALERT_TYPE) as AlertType[]) {
        const candidates = candidatesByType[type];
        const currentDedupeKeys = candidates.map((c) => c.dedupeKey);

        for (const candidate of candidates) {
          const existing = await Alert.findOpenByDedupeKey(candidate.userId, candidate.dedupeKey);

          if (!existing) {
            // Not currently OPEN — but check whether this is a RECURRENCE of
            // something the user already dismissed, before creating a new
            // document. Reopening the same document (rather than creating a
            // second one with the same dedupeKey) keeps one continuous
            // history per real-world anomaly instance instead of
            // fragmenting it across multiple documents.
            const dismissed = await Alert.findDismissedByDedupeKey(candidate.userId, candidate.dedupeKey);

            if (dismissed) {
              dismissed.status = ALERT_STATUS.OPEN;
              dismissed.dismissedAt = null;
              dismissed.dataPoints = candidate.dataPoints;
              dismissed.severity = candidate.severity;
              await dismissed.save();

              needsReasoning.push({ alertId: dismissed._id.toString(), dedupeKey: candidate.dedupeKey, type: candidate.type, dataPoints: candidate.dataPoints });
              reopenedAlerts.push({ alertId: dismissed._id.toString(), type: candidate.type, severity: candidate.severity, productId: candidate.productId, storeId: candidate.storeId, dedupeKey: candidate.dedupeKey });
              continue;
            }

            const created = await Alert.create({
              userId: candidate.userId,
              type: candidate.type,
              severity: candidate.severity,
              productId: candidate.productId,
              storeId: candidate.storeId,
              dataPoints: candidate.dataPoints,
              dedupeKey: candidate.dedupeKey,
              status: ALERT_STATUS.OPEN,
            });

            needsReasoning.push({ alertId: created._id.toString(), dedupeKey: candidate.dedupeKey, type: candidate.type, dataPoints: candidate.dataPoints });
            newAlerts.push({ alertId: created._id.toString(), type: candidate.type, severity: candidate.severity, productId: candidate.productId, storeId: candidate.storeId, dedupeKey: candidate.dedupeKey });
            continue;
          }

          // Existing OPEN alert. STOCK_DROP is immutable once created — a
          // historical event doesn't get "refreshed" — so only
          // ongoing-condition types are eligible to update in place.
          if (!ONGOING_CONDITION_TYPES.includes(type)) continue;

          const dataChanged = JSON.stringify(existing.dataPoints) !== JSON.stringify(candidate.dataPoints);
          const severityChanged = existing.severity !== candidate.severity;
          if (!dataChanged && !severityChanged) continue; // truly unchanged — skip the write AND skip reasoning regen

          existing.dataPoints = candidate.dataPoints;
          existing.severity = candidate.severity;
          await existing.save();

          needsReasoning.push({ alertId: existing._id.toString(), dedupeKey: candidate.dedupeKey, type: candidate.type, dataPoints: candidate.dataPoints });
        }

        // Auto-resolve — ONLY for ongoing-condition types. See CONTEXT
        // above for why STOCK_DROP is deliberately excluded from this.
        if (ONGOING_CONDITION_TYPES.includes(type)) {
          await Alert.updateMany({ type, status: ALERT_STATUS.OPEN, dedupeKey: { $nin: currentDedupeKeys } }, { $set: { status: ALERT_STATUS.RESOLVED, resolvedAt: new Date() } });
        }
      }

      return { needsReasoning, newAlerts, reopenedAlerts };
    });

    // ------------------------------------------------------------------
    // STEP GROUP 3 — Reasoning. Only for alerts flagged above as new or
    // materially changed — an unchanged ongoing-condition alert doesn't
    // burn another Gemini call re-explaining numbers that haven't moved.
    // ------------------------------------------------------------------

    if (reconcileResult.needsReasoning.length > 0) {
      const reasoningResults = await step.run('generate-reasoning', async () => {
        return await generateReasoning(reconcileResult.needsReasoning);
      });

      await step.run('persist-reasoning', async () => {
        await connectDB();

        const alertIdByDedupeKey = new Map(reconcileResult.needsReasoning.map((r) => [r.dedupeKey, r.alertId]));

        const bulkOps = reasoningResults
          .map((result) => {
            const alertId = alertIdByDedupeKey.get(result.dedupeKey);
            // Defensive only — generateReasoning guarantees exactly one
            // result per input dedupeKey, so this should never be hit.
            if (!alertId) {
              console.warn(`⚠️ [ANOMALY_AGENT] Reasoning result for dedupeKey "${result.dedupeKey}" has no matching alertId — dropping it.`);
              return null;
            }
            return { updateOne: { filter: { _id: alertId }, update: { $set: { reasoning: result.reasoning } } } };
          })
          .filter((op): op is NonNullable<typeof op> => op !== null);

        if (bulkOps.length > 0) await Alert.bulkWrite(bulkOps);

        return { persisted: bulkOps.length };
      });
    }

    // ------------------------------------------------------------------
    // STEP GROUP 4 — Telemetry. One PostHog event per NEW alert (mirrors
    // smartStockout.ts's per-item `highRIskIds.forEach(ph.capture)`
    // pattern) and one per REOPENED alert (distinct event — reopening a
    // dismissed alert is a meaningfully different thing than creating a
    // fresh one, worth telling apart in analytics later), then flush both
    // PostHog and Langfuse before the step exits.
    // ------------------------------------------------------------------

    await step.run('telemetry', async () => {
      const ph = PostHogClient();

      for (const alert of reconcileResult.newAlerts) {
        ph.capture({
          distinctId: 'system_background_job',
          event: POSTHOG_EVENT_ALERT_CREATED,
          properties: { alertId: alert.alertId, type: alert.type, severity: alert.severity, productId: alert.productId, storeId: alert.storeId, dedupeKey: alert.dedupeKey },
        });
      }

      for (const alert of reconcileResult.reopenedAlerts) {
        ph.capture({
          distinctId: 'system_background_job',
          event: POSTHOG_EVENT_ALERT_REOPENED,
          properties: { alertId: alert.alertId, type: alert.type, severity: alert.severity, productId: alert.productId, storeId: alert.storeId, dedupeKey: alert.dedupeKey },
        });
      }

      await ph.shutdown();
      await flushTelemetry();
    });

    return {
      newAlerts: reconcileResult.newAlerts.length,
      reopenedAlerts: reconcileResult.reopenedAlerts.length,
      reasoningGenerated: reconcileResult.needsReasoning.length,
    };
  }
);
