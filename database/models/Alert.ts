// ==========================================
// 🔎 CONTEXT
// ==========================================

// This is the data layer for Feature 2 (Inventory Anomaly Agent).
//
// Alerts are written by a deterministic detector (lib/anomalies/detectors.ts)
// and then annotated with LLM-generated `reasoning` (lib/anomalies/generateReasoning.ts).
// The LLM NEVER decides whether an anomaly exists — it only explains one that
// the code has already found, using only the numbers in `dataPoints`. This
// mirrors Feature 1's grounding discipline: the visible data (dataPoints)
// does not depend on the model having summarized correctly.
//
// ⚠️ DEDUPE MODEL — read before touching the reconcile logic in Phase 4:
// `dedupeKey` identifies "the same underlying anomaly" across cron runs so a
// 6-hourly job doesn't spam a new alert every run for one ongoing problem.
//
//   - Discrete-event types (STOCK_DROP only): dedupeKey is tied to a specific
//     point in time (the triggering InventoryLedger _id), so dismissing or
//     resolving one never suppresses a genuinely NEW drop later.
//   - Ongoing-condition types (NEGATIVE_STOCK, SYNC_DRIFT,
//     STORE_STATE_CONTRADICTION, STOCKOUT_RISK): dedupeKey is stable per
//     entity (productId or storeId), because the "event" is a persistent
//     state, not a moment. NEGATIVE_STOCK belongs here, not with STOCK_DROP —
//     a product sitting at -3 units is an ongoing condition, not a one-time
//     occurrence, and keying it to a ledger entry would require the same
//     "find the crossing point" complexity as queryInventory.ts's duration
//     logic for what's supposed to be the cheapest detector in the set.
//
// The uniqueness constraint below is a PARTIAL index scoped to `status: OPEN`.
// This is deliberate: a DISMISSED or RESOLVED alert must never block a new
// OPEN alert with the same dedupeKey from being created later. Whether the
// Phase 4 reconcile step actually chooses to recreate one (vs. respecting an
// existing DISMISSED alert whose dataPoints haven't materially changed) is
// reconcile-logic, not a schema constraint — the schema just needs to allow
// either behavior.
//
// ⚠️ VERIFIED ASSUMPTION: `dataPoints` is intentionally `Mixed` because its
// shape differs per `type` (e.g. {oldStock, newStock, pctChange} for a drop
// vs. {stock, velocity, daysRemaining} for stockout risk). This is the same
// tradeoff Store.config makes (flexible config, Zod handles strict typing
// at the write boundary) — Zod schemas per anomaly type live in
// lib/anomalies/detectors.ts, not here.

// ==========================================
// 📦 Imports
// ==========================================

import { Schema, models, model, Model, Document, Types } from 'mongoose';

// ==========================================
// 💿 CONSTANTS
// ==========================================

export const ALERT_TYPE = {
  STOCK_DROP: 'STOCK_DROP',
  NEGATIVE_STOCK: 'NEGATIVE_STOCK',
  SYNC_DRIFT: 'SYNC_DRIFT',
  STORE_STATE_CONTRADICTION: 'STORE_STATE_CONTRADICTION',
  STOCKOUT_RISK: 'STOCKOUT_RISK',
} as const;

export const ALERT_TYPES = Object.values(ALERT_TYPE);

export const ALERT_SEVERITY = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' } as const;
export const ALERT_SEVERITIES = Object.values(ALERT_SEVERITY);

// NOTE: order matters for the state machine, not just display —
// see the pre-save hook below.
export const ALERT_STATUS = { OPEN: 'OPEN', RESOLVED: 'RESOLVED', DISMISSED: 'DISMISSED' } as const;
export const ALERT_STATUSES = Object.values(ALERT_STATUS);

// ==========================================
// 🚓 INTERFACES
// ==========================================

export type AlertType = (typeof ALERT_TYPE)[keyof typeof ALERT_TYPE];
export type AlertSeverity = (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY];
export type AlertStatus = (typeof ALERT_STATUS)[keyof typeof ALERT_STATUS];

export interface IAlert extends Document {
  // Ownership
  userId: Types.ObjectId;

  // Classification
  type: AlertType;
  severity: AlertSeverity;

  // Scope — exactly one of these is populated depending on `type`.
  // STOCK_DROP / NEGATIVE_STOCK / STOCKOUT_RISK        → productId
  // SYNC_DRIFT / STORE_STATE_CONTRADICTION             → storeId
  productId?: Types.ObjectId;
  storeId?: Types.ObjectId;

  // The evidence — see CONTEXT above. This is what the LLM is given and
  // what the frontend renders directly (not the LLM's prose), same
  // "second grounding layer" pattern as Feature 1's results card.
  dataPoints: Record<string, unknown>;

  // Set by lib/anomalies/generateReasoning.ts. Null until that step runs —
  // an alert can exist (and be shown, minus the explanation) before its
  // reasoning is generated, since detection and reasoning are separate
  // Inngest steps that can fail independently.
  reasoning: string | null;

  // Dedup / lifecycle — see CONTEXT above.
  dedupeKey: string;
  status: AlertStatus;
  resolvedAt: Date | null;
  dismissedAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  dismiss(): Promise<void>;
  resolve(): Promise<void>;
}

interface IAlertModel extends Model<IAlert> {
  findOpenByDedupeKey(userId: string | Types.ObjectId, dedupeKey: string): Promise<IAlert | null>;
}

// ==========================================
// 🏛️ SCHEMA
// ==========================================

const AlertSchema = new Schema<IAlert>(
  {
    // Ownership
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Classification
    type: { type: String, enum: ALERT_TYPES, required: true, index: true },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },

    // Scope — intentionally NOT required at the schema level (see interface
    // comment above for which field applies to which type). Cross-field
    // validation ("productId required iff type is product-scoped") belongs
    // in the detector layer, which already knows the type when constructing
    // the document — duplicating that rule here via a custom validator would
    // just be a second place for it to drift out of sync.
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', index: true },

    // Evidence
    dataPoints: { type: Schema.Types.Mixed, required: true },

    // LLM output — nullable, see interface comment
    reasoning: { type: String, default: null },

    // Dedup / lifecycle
    dedupeKey: { type: String, required: true },
    status: { type: String, enum: ALERT_STATUSES, default: ALERT_STATUS.OPEN, index: true },
    resolvedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
  },

  { timestamps: true }
);

// ==========================================
// ⚡️ VIRTUALS - Variables on the fly
// ==========================================

// ==========================================
// 🛡 PRE-SAVE HOOKS - The integrity guard
// ==========================================

// Keep resolvedAt/dismissedAt consistent with status even if a caller sets
// `status` directly via a bulk update path instead of calling .resolve()/
// .dismiss() — bulkWrite (used for the reconcile step's bulk resolve of
// stale alerts) bypasses document middleware entirely, so this hook is a
// safety net for single-document .save() calls only. The reconcile step's
// bulkWrite MUST set resolvedAt explicitly itself — documented here so that
// isn't missed when Phase 4 is implemented.
AlertSchema.pre('save', function () {
  if (!this.isModified('status')) return;

  if (this.status === ALERT_STATUS.RESOLVED && !this.resolvedAt) this.resolvedAt = new Date();
  if (this.status === ALERT_STATUS.DISMISSED && !this.dismissedAt) this.dismissedAt = new Date();
});

// ==========================================
// 🔧 METHODS (Instance Logic)
// ==========================================

AlertSchema.methods.dismiss = async function () {
  this.status = ALERT_STATUS.DISMISSED;
  this.dismissedAt = new Date();
  await this.save();
};

AlertSchema.methods.resolve = async function () {
  this.status = ALERT_STATUS.RESOLVED;
  this.resolvedAt = new Date();
  await this.save();
};

// ==========================================
// 🔍 STATICS (Model Queries)
// ==========================================

AlertSchema.statics.findOpenByDedupeKey = function (userId: string | Types.ObjectId, dedupeKey: string) {
  return this.findOne({ userId, dedupeKey, status: ALERT_STATUS.OPEN });
};

// ==========================================
// 🏎️ INDEXES - Speed up queries
// ==========================================

// 1. The dedupe constraint — see CONTEXT above for why this is PARTIAL
//    (scoped to OPEN only) rather than a plain unique index on dedupeKey.
AlertSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { status: ALERT_STATUS.OPEN } });

// 2. The frontend's default view: "my open alerts, newest first"
AlertSchema.index({ userId: 1, status: 1, createdAt: -1 });

// ==========================================
// ⛩️ The Next.js Singleton Pattern (CRITICAL)
// ==========================================
// Check if model exists before compiling to prevent hot-reload crashes
const Alert = (models.Alert as IAlertModel) || model<IAlert, IAlertModel>('Alert', AlertSchema);
export default Alert;
