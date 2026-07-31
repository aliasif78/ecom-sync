# 🔄 EcomSync

**Live:** [ecom-sync-theta.vercel.app](https://ecom-sync-theta.vercel.app/)

A multi-channel inventory synchronization engine with an AI layer for natural-language inventory queries and automated anomaly detection. Built to prevent revenue leakage from oversells and manual cross-platform updates, then extended with two production-grade AI features on top of the same data model.

> **⚠️ Integration status:** Shopify, Amazon, and WooCommerce connections in this project are **simulated**, not live third-party API integrations. The sync engine, locking, retry logic, and data model are built exactly as they would be for real connections — the adapter layer (`lib/adapters`) is the seam where real platform SDKs would plug in — but no live store credentials are exchanged with real platforms in the current deployment. Stated here first because it matters more than anything else in this document.

---

## The Problem

Selling across Shopify, Amazon, and WooCommerce simultaneously creates a specific failure mode: a sale on one platform doesn't update stock on the others until someone does it manually. That gap causes oversells, silent drift between platforms, and no single source of truth for total inventory.

## The Core System

- **⚙️ Event-Driven Orchestration (Inngest):** Fans out SKU updates across all active stores as durable, retryable background steps — never blocking the request path.
- **🔒 Distributed Concurrency Control (Upstash Redis):** Distributed locks prevent two concurrent sync jobs from writing to the same SKU, eliminating race-condition stock corruption.
- **⚡ Real-Time Telemetry (Pusher):** Sync progress and failures stream directly to the UI — no polling.
- **📋 Immutable Inventory Ledger:** Every stock movement is written as an append-only event (`INVENTORY_ADJUSTED`, `ORDER_FULFILLMENT`, etc.) in MongoDB. Full audit trail; nothing is overwritten in place.
- **🛡️ Hybrid Identity:** Supabase Auth (OAuth, OTP) for authentication, merged with MongoDB-stored profiles for domain data.

### Tech Stack

| Layer          | Technologies                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui                                              |
| Backend        | Next.js Route Handlers & Server Actions, Inngest, Supabase Auth, Zod                                                  |
| AI             | Vercel AI SDK (`ai@6.0.238`), Google Gemini (`gemini-3.1-flash-lite` primary / `gemini-2.5-flash` fallback), Langfuse |
| Infrastructure | MongoDB (Mongoose), Upstash Redis, Pusher, AWS S3, PostHog                                                            |

### Quick Start

```bash
git clone https://github.com/aliasif78/ecom-sync.git
cd ecom-sync
npm install
cp .env.example .env.local
npm run dev
```

---

## The AI Layer

Two AI features are shipped, both built directly on the existing MongoDB data model — no separate AI-specific database, no vector store. Both follow the same architectural principle: **deterministic code owns every judgment that can be computed; the LLM is only ever asked to explain a result it did not produce.**

### Feature 1 — Natural Language Inventory Queries

Ask _"Which SKUs have been out of stock on Amazon for more than 3 days?"_ and get a grounded answer sourced directly from live inventory data. Available at `/api/chat/query`, surfaced as the **Ask** tab of the dashboard's Copilot widget — kept architecturally separate from the **Act** tab, which handles mutations.

**Why this isn't RAG.** The project brief describes this as "RAG + tool calling." It isn't RAG, and the distinction matters. RAG solves for unstructured data too large to fit in a prompt — you embed it, chunk it, retrieve top-k at query time. This data (`Product`, `InventoryLedger`) is already structured and already exactly filterable; "stock below 10" needs a `$lt` operator, not semantic similarity search. What this actually is: **structured tool-calling with grounded generation.** The model maps natural language onto a small, fixed set of parameters — it never writes or sees a raw database query, and its answer is constrained to only what a deterministic query returned.

**Flow:**

```
NL query → /api/chat/query (auth-gated, read-only tool set — no mutation tool reachable)
  → model maps NL → { condition, platform, threshold, minDurationDays }
  → Zod validates the combination (rejects stockAbove/stockBelow with no threshold)
  → queryInventory() — hand-written, unit-tested Mongo queries, scoped to userId
  → tool returns { resolvedParams, count, results }
  → model generates final text, constrained to only what the tool returned
  → streamed to client, rendered as a structured results card
```

**Grounding, enforced two ways:**

- _Prompt-level:_ the model must call the tool before answering, may only reference values literally present in `results`, must state a `count: 0` plainly rather than soften it, and must decline out-of-scope questions (trends, pricing, "why") rather than force-fit them onto the four supported conditions.
- _Code-level:_ the results card renders directly from the tool's structured output, not from parsing the model's prose. Even an imprecise model summary doesn't corrupt what the user actually sees.

**Security:** `userId` is never part of the model-facing input schema — it's a constructor argument closed over server-side by `createQueryInventoryTool(userId)`, sourced from the authenticated session, and enforced in the actual Mongo filter on every query branch. A prompt injection cannot leak another tenant's data because the model has no path to supply its own `userId`.

**Platform/duration semantics:** stock is a single unified number per product, not per-platform — correct for preventing oversells, but means "out of stock on Amazon" is defined as `stock === 0 AND` an active mapping to that platform exists, not a real per-platform stock field. Duration is derived from ledger history (the most recent crossing point into the current streak), not a stored timestamp — this correctly handles a product that recovered and dropped again, reflecting only the current continuous streak.

### Feature 2 — Inventory Anomaly Agent

A background agent (`inventory-anomaly-agent`, Inngest scheduled function) runs every 6 hours, detects five categories of anomaly, and writes each as a structured `Alert` with a plain-English explanation. Surfaced at `/alerts`, plus a live risk badge on the products page. Replaces an earlier single-purpose stockout cron entirely (see _Superseded work_ below).

| Type                        | Catches                                                                       | Detection logic                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `STOCK_DROP`                | Sudden large stock decrease                                                   | ≥5 units **and** ≥30% drop within a 24h lookback                                                             |
| `NEGATIVE_STOCK`            | Data-integrity failure — stock below zero                                     | `stock < 0`                                                                                                  |
| `SYNC_DRIFT`                | A synced store with more recent platform activity than its last recorded sync | Ledger activity newer than `lastSyncAt` by >12h                                                              |
| `STORE_STATE_CONTRADICTION` | A store set to sync while not actually connected                              | Direct state check                                                                                           |
| `STOCKOUT_RISK`             | A product projected to run out soon                                           | 14-day rolling velocity from genuine fulfillment events (min. 3 orders), projecting a stockout within 7 days |

Severity (`LOW`/`MEDIUM`/`HIGH`) is computed deterministically from the same numbers that triggered detection — never assigned by the model.

**Code detects, LLM explains.** Every anomaly is found by deterministic aggregation and threshold logic (`lib/anomalies/detectors.ts`). The model is never asked whether something is an anomaly — it receives a closed list of already-confirmed `{dedupeKey, type, dataPoints}` records and writes one or two grounded sentences per item, using `generateText` with structured `Output.object()` output.

Two safeguards keep this split from eroding under batching (up to 20 anomalies per call, for cost efficiency):

1. Every generated sentence is checked post-hoc for whether it actually references its own item's identifying value (SKU, product, or store name). If it doesn't — or a `dedupeKey` was dropped or invented — that item falls back to a deterministic, template-built sentence assembled directly from `dataPoints`. Every alert gets correct reasoning; none can be silently misattributed.
2. The `/alerts` UI renders `dataPoints` as its own grid, independent of the `reasoning` text — the same principle as Feature 1's results card. What the user sees numerically is never solely the model's word for it.

**Deduplication and lifecycle:** discrete events (`STOCK_DROP`) key to the specific ledger entry that triggered them — a second drop gets its own alert. Ongoing conditions (the other four types) key stably per product/store and auto-resolve once no longer detected. `STOCK_DROP` is deliberately excluded from auto-resolve — its 24h lookback window would age every alert out regardless of whether anyone saw it, so it stays `OPEN` until a human dismisses it. Dismissing a still-unresolved ongoing condition reopens the same document on the next run rather than fragmenting its history across duplicates.

**Explicitly out of scope, and why:** cross-platform pricing-inconsistency detection and full cross-platform sync-failure detection were both considered and cut. `Product.price` has no per-platform value or history, so "Shopify and Amazon prices disagree" can't be checked against real data. Only the Amazon mapping persists a `syncStatus`/error; Shopify and WooCommerce failures exist only as transient retry events, never written anywhere queryable. `SYNC_DRIFT` is the honest version of the latter — it catches staleness, which the data supports, rather than claiming to catch "failure," which it doesn't.

**Superseded work:** the earlier `smartStockoutCheck` daily cron is fully removed. It called the raw Gemini SDK directly (no Vercel AI SDK, no Langfuse tracing, no model fallback) and let the model assign risk with no downstream validation. Its one reusable piece — 14-day sales velocity — was carried forward into `detectStockoutRisk`, corrected to count only genuine fulfillment events with a minimum sample size rather than any negative ledger change.

---

## Reliability & Observability

- **Model fallback:** implemented as AI SDK language-model middleware (`wrapLanguageModel`), not call-site try/catch — a try/catch doesn't port cleanly to a streaming response that may already be in flight. Falls back from `gemini-3.1-flash-lite` to `gemini-2.5-flash` on retryable failures (429, 5xx, 404/model-not-found, network) — deliberately not on 400/401/403, since a different model on the identical broken request or credential would fail identically.
- **Tracing:** both features are instrumented with Langfuse — every model call, tool call, and retry is traceable per request (`functionId: inventory-query-agent` / `anomaly-reasoning-agent`). Traces are captured per-call; there is currently no session-level grouping across a multi-turn conversation.
- **Cost:** tracked and visible per-call in Langfuse for both features. A separate computed per-run aggregate has not been built — Langfuse is the source of truth rather than a second, easily-stale calculation maintained in code.

## Known Limitations

Stated directly rather than left for a client to discover:

- **Store connections are simulated**, not live third-party integrations (see top of document).
- **Duration and drift lookups have N+1 query patterns** (`queryInventory`'s continuous-streak lookup, `detectSyncDrift`'s per-store checks) — acceptable at demo scale (dozens to low hundreds of products), would need rewriting as aggregation pipelines with `$lookup` at real scale.
- **No true per-platform stock field** — a single unified stock number per product means "out of stock on Amazon" is inferred from mapping existence, not a real per-platform value.
- **`minDurationDays` is a rolling hour window, not calendar-aligned** — "3+ days" means 72 continuous hours, not 3 calendar days in any timezone.
- **All anomaly thresholds are reasoned defaults calibrated against synthetic seed data** — the stock-drop floor, sync-drift tiers, stockout-risk tiers, and minimum sample size for trusting a velocity figure are not validated against real production traffic.
- **The reasoning grounding check verifies topical relevance, not full numeric correctness** — it confirms the model referenced the right entity, not that every number in its sentence is accurate. The deterministic template fallback is the actual correctness guarantee when it fires.
- **No deterministic text fallback if a tool call succeeds but the model generates no follow-up text** — a real, reproduced failure mode during testing, currently only indirectly mitigated by the model-fallback middleware. Synthesizing a deterministic answer server-side from the tool's own output whenever this happens is a documented next step, not yet built.

---

## Repository

[github.com/aliasif78/ecom-sync](https://github.com/aliasif78/ecom-sync)
