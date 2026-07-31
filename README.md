# 🔄 Ecom Sync - https://ecom-sync-theta.vercel.app/

> **A multi-channel inventory synchronization engine.** Prevents revenue leakage by propagating stock changes across multiple storefronts with controlled concurrency, retry safety, and real-time state visibility.

## 🏗️ Architecture & Key Capabilities

- ⚙️ **Event-Driven Orchestration (Inngest):** Fans out SKU updates across active stores. Handles user throttling and background retries without blocking the main request path.
- 🔒 **Distributed Concurrency Control (Upstash Redis):** Employs distributed locks to completely prevent duplicate writes and race conditions during high-burst traffic.
- ⚡ **Real-Time Telemetry (Pusher):** Streams sync events (completion/failure) directly to the UI, eliminating database polling and giving operators instant feedback.
- 🛡️ **Hybrid Identity (Supabase + MongoDB):** Merges Supabase Auth (OAuth, OTP) with custom MongoDB profiles to handle complex domain data securely.

## 🛠️ Tech Stack

- **💻 Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **⚙️ Backend:** Next.js Route Handlers & Server Actions, Inngest, Supabase Auth, Pusher, Zod
- **🗄️ Infrastructure:** MongoDB (Mongoose), Upstash Redis, AWS S3, PostHog

## 🚀 Quick Start

```bash
git clone [https://github.com/aliasif78/ecom-sync.git](https://github.com/aliasif78/ecom-sync.git)
cd ecom-sync
npm install
cp .env.example .env.local
npm run dev

## Feature 1: Natural Language Inventory Queries

Ask questions like *"Which SKUs have been out of stock on Amazon for more than 3 days?"* and get a grounded, human-readable answer sourced directly from live inventory data — no manual filtering, no cross-referencing the ledger by hand.

Available at `/api/chat/query`, surfaced in the product dashboard via the **Ask** tab of the Copilot widget (kept architecturally separate from the **Act** tab, which handles stock mutations — see *Design decisions* below).

### Why this isn't RAG

The original project plan describes this feature as "RAG + tool calling." It isn't RAG, and it's worth being precise about why rather than letting the label stick.

RAG solves a specific problem: your data is unstructured (documents, prose) and too large to fit in a prompt, so you embed it, chunk it, and retrieve the top-k relevant pieces at query time. This feature's data — `Product` and `InventoryLedger` documents in MongoDB — is already structured and already exactly filterable. "SKUs with stock below 10" doesn't benefit from semantic similarity search; it needs a `$lt` operator. Embedding and vector-searching this data would be slower, non-deterministic, and could miss exact matches a real query would never miss.

What this feature actually is: **structured tool-calling with grounded generation.** The model's only job is to map natural language onto a small, fixed set of structured parameters. It never writes or influences a database query directly, and its final answer is constrained to only what a deterministic query returned — which is where the "no hallucination" property RAG is known for actually comes from here, without needing embeddings or a vector store anywhere in the pipeline.

### Architecture

```

User query (NL)
↓
POST /api/chat/query (auth-gated, read-only tool set — no mutation tool reachable)
↓
streamText + queryInventory tool
↓
Model maps NL → { condition, platform, threshold, minDurationDays }
↓
Zod validates the structured params (rejects invalid combos before DB is touched)
↓
queryInventory() — hand-written, independently unit-tested Mongo queries
↓
Tool returns { resolvedParams, count, results }
↓
Model generates final text, constrained to only what the tool returned
↓
Streamed to client → rendered in a structured results card (not just prose)

```

**The model never generates or sees a raw database query.** Its input schema is a closed set — four conditions (`outOfStock` / `lowStock` / `stockAbove` / `stockBelow`), an optional platform filter, an optional threshold, an optional minimum-duration-in-days. Zod enforces the one combination that would otherwise silently break (`stockAbove`/`stockBelow` without a `threshold`) before the query layer is ever invoked. This is deliberate: letting an LLM construct queries directly is a correctness and injection risk; constraining it to picking values for a fixed, pre-validated shape is not.

### Grounding mechanism

The system prompt enforces, and testing confirmed holds under real model calls:
- The model must call `queryInventory` before answering any stock-related question — never answer from memory.
- The final answer may only reference SKUs, names, numbers, and durations that literally appear in the tool's `results` array.
- A `count` of `0` must be stated plainly ("no products matched") rather than softened or guessed around.
- Questions outside the tool's scope (sales trends, pricing, "why" something happened) are explicitly declined rather than force-mapped onto one of the four conditions.

The frontend adds a second, code-level layer of grounding on top of the model's: the results card renders directly from the tool's structured output (`resolvedParams`, `count`, `results`), not from parsing the model's prose. Even if the model's summary were imprecise, the visible data table is not derived from it.

### Platform and duration semantics

The data model tracks a single, unified stock number per product (`Product.stock`), not a per-platform figure — correct for preventing oversells, but it means "out of stock on Amazon" cannot mean "Amazon's stock value is 0," because no such value exists. It's defined here as:

> `stock === 0` **and** the product has an active mapping to that platform (`mappings.<platform>.storeId` exists)

Duration (`minDurationDays`) is derived from `InventoryLedger` history, not a stored "since" timestamp: for a product currently in a condition, the system finds the most recent ledger entry that was *outside* that condition, then the next entry after it — that crossing point is when the current, continuous streak began. This correctly handles a product that dropped to zero, recovered, and dropped again — duration reflects the current streak only, not the first time it ever happened.

This relies on a verified assumption: `InventoryLedger.oldStock`/`newStock` track the product's *total* stock (confirmed against `syncProductStock` in `actions/inventory.ts`), not a per-location number. If a future code path starts writing genuinely per-location ledger entries, this duration logic needs revisiting.

### Reliability

- **Model fallback**: implemented as AI SDK language-model middleware (`wrapLanguageModel` + custom `wrapStream`/`wrapGenerate`), not a call-site try/catch — the latter doesn't port cleanly to a streaming response, since a client-visible stream may already be in flight by the time an error surfaces. Falls back from `gemini-3.1-flash-lite` to `gemini-2.5-flash` on retryable failures (429, 5xx, model-not-found/404, network errors) but deliberately *not* on 400/401/403 — those indicate a broken request or credential, which a different model receiving the identical request/key would fail identically.
- **Observability**: traced via Langfuse. Note for anyone maintaining this: the project runs `ai@6.0.238`, not AI SDK 7 — telemetry is wired through the "legacy" `@vercel/otel` + `langfuse-vercel` path, not the newer `@langfuse/vercel-ai-sdk` package (which has an `ai >=7` peer dependency and will fail to install here). Don't copy AI SDK 7-era Langfuse docs verbatim against this codebase without checking which major version is actually installed.

### Known limitations

Documented here rather than left for a client to discover:

- **Duration query performance**: the continuous-streak lookup runs up to two extra MongoDB queries per candidate product (N+1). Fine at demo/portfolio scale (dozens to low hundreds of products); at real scale this should become a single aggregation pipeline with `$lookup`.
- **No calendar-day alignment**: `minDurationDays` is a rolling 24-hour-multiple window measured from `Date.now()`, not aligned to calendar day boundaries or any particular timezone. "3+ days" means "at least 72 continuous hours," which will occasionally read as off-by-one against a user's intuitive sense of calendar days.
- **Rapid oscillation is intentional, not a bug, but worth knowing about**: if a product's stock flips out-of-stock and back within the same day, the duration counter resets to the new streak immediately — by design, this is "continuous days in the current state," not "cumulative days ever in this state." A product oscillating rapidly will show a very low duration even if it's been unstable for a while; there's no separate "flakiness" signal surfaced anywhere.
- **Fallback only covers pre-generation failures**: the model middleware catches errors that occur before any tokens are streamed (bad key, rate limit, deprecated model, network failure) — the large majority of real-world failures. It does *not* handle a connection dropping mid-stream after tokens have already reached the client; that's a substantially harder problem (partial-response splicing) and is out of scope here.
- **No deterministic text fallback**: during testing, the model occasionally completed a tool call successfully but generated zero text on the follow-up step — a real, reproduced failure mode, not hypothetical. Currently mitigated only by the model fallback (an empty completion from the primary can trigger a retry-adjacent path if classified as retryable, but this is not guaranteed for all empty-completion cases). A stronger fix — synthesizing a deterministic answer server-side from `resolvedParams`/`results` whenever a tool call succeeds but no text follows — is a documented next step, not yet built.
- **Read/write separation is UI-level as well as route-level**: the mutation-capable tool set is unreachable from `/api/chat/query` at the code level (the strongest guarantee), but the frontend also keeps Ask and Act as separate `useChat` instances so a user can't accidentally issue a mutation-intent phrase while in Ask mode and have it silently routed to the wrong tool set.
- **Langfuse sessions are not implemented** — traces are captured per call, but there's no session-level grouping across a multi-turn conversation. Would require explicit session ID propagation, not currently wired in.
```

# Feature 2: Inventory Anomaly Agent

## Overview

A background agent that reviews inventory data every 6 hours, detects five specific categories of anomaly, and surfaces each one as an `Alert` with a plain-English explanation — replacing the earlier `smartStockoutCheck` cron, which only flagged one thing (stockout risk) via a single boolean field with no persisted reasoning and no audit trail.

The agent runs as an Inngest scheduled function (`inventory-anomaly-agent`, `lib/inngest/functions/anomalyAgent.ts`), writes to a dedicated `Alert` collection (`database/models/Alert.ts`), and is surfaced in the UI at `/alerts`, plus a live "Stockout Risk" badge on the products page.

## Anomaly Types Detected

| Type                        | What it catches                                                                                               | Detection logic                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `STOCK_DROP`                | A single sudden, large stock decrease                                                                         | A ledger entry with both an absolute floor (≥5 units) **and** a relative threshold (≥30% of prior stock) drop, within a 24h lookback       |
| `NEGATIVE_STOCK`            | A product sitting at a negative stock value                                                                   | `stock < 0` — a data-integrity signal (an oversell that slipped past whatever should have blocked it), not a business-metric judgment call |
| `SYNC_DRIFT`                | A connected, sync-enabled store whose platform has more recent inventory activity than its last recorded sync | Ledger activity for that store's mapped products newer than `lastSyncAt` by more than 12h                                                  |
| `STORE_STATE_CONTRADICTION` | A store configured to sync (`isSyncEnabled: true`) while not actually connected (`isConnected: false`)        | Direct state check — no threshold, the condition itself is the anomaly                                                                     |
| `STOCKOUT_RISK`             | A product projected to run out soon based on real sales velocity                                              | 14-day rolling velocity (genuine `ORDER_FULFILLMENT` sales only, minimum 3 distinct orders — see below) projecting stockout within 7 days  |

Each type carries a severity (`LOW` / `MEDIUM` / `HIGH`) computed deterministically from the same numbers that triggered detection — never assigned by the LLM.

## What Was Deliberately Excluded, and Why

The original feature scope also called for detecting **pricing inconsistencies across platforms** and **sync failures between all three platforms** (Shopify/Amazon/WooCommerce). Both were cut after checking what the schema can actually prove, not after checking what sounded good in the spec:

- **Pricing inconsistencies**: `Product.price` is a single unified field. No per-platform price is stored anywhere in `mappings.shopify` / `mappings.amazon` / `mappings.woocommerce`, and there's no price history. Detecting "the Shopify price and Amazon price disagree" requires data this system doesn't capture. Fabricating this feature without the underlying field would mean pointing at nothing if a client asked to see it work.
- **Full cross-platform sync failures**: only `mappings.amazon` persists a `syncStatus`/`lastSyncError`. Shopify and WooCommerce are "immediate response" integrations (see `Store.ts` constraints) — their failures exist only as transient Inngest step-retry events, never written anywhere queryable on the Product or Store document. `SYNC_DRIFT` (above) is the honest version of this: it catches staleness, which the data supports, rather than claiming to catch "failure," which it doesn't.

Both are documented gaps, not silent ones — the fix for either (adding per-platform price fields; adding persisted sync-failure state to Shopify/WooCommerce mappings) is a schema change, deliberately out of scope for this feature rather than something shipped half-working.

## Architecture: Code Detects, LLM Explains

Every anomaly is found by deterministic code (`lib/anomalies/detectors.ts`) — threshold checks, aggregations, direct state comparisons. The LLM (`lib/anomalies/generateReasoning.ts`) is never asked whether something is an anomaly; it's given a closed list of already-confirmed `{dedupeKey, type, dataPoints}` records and asked only to write one or two grounded sentences per item. This mirrors the same correction made to Feature 1's RAG pipeline (Week 6): don't let the model own a judgment that should be deterministic and auditable.

Two layers enforce this split doesn't quietly erode:

1. **Batching risk**: sending multiple anomalies in one call for cost efficiency means the model could misattribute one item's numbers to another's `dedupeKey`. Every generated reasoning is checked post-hoc — does it actually mention the anomaly's own identifying value (SKU, product name, or store name)? If not, or if the model dropped/invented a `dedupeKey`, that item falls back to a **deterministic, template-built sentence assembled directly from `dataPoints`** — guaranteeing every alert gets _some_ correct reasoning, never a hallucinated or silently misattributed one.
2. **Visible data doesn't depend on the model having summarized correctly**: the `/alerts` UI renders `dataPoints` as its own grid, separately from the `reasoning` text — the same "second grounding layer" pattern as Feature 1's results card. The numbers a user sees are never solely the LLM's word for it.

Model calls use the Vercel AI SDK's `generateText` with structured `output: Output.object({ schema })` (the currently-correct API — `generateObject` is deprecated as of the installed SDK version), reusing Feature 1's `resilientQueryModel` (model-agnostic fallback middleware) and the app's existing Langfuse/OTel telemetry wiring verbatim.

## Deduplication, Resolution, and Reopening

Each candidate anomaly gets a `dedupeKey` so a job running every 6 hours doesn't spam a new alert for one ongoing problem:

- **Discrete-event type** (`STOCK_DROP` only): keyed to the specific triggering ledger entry. A product having a second, later drop gets its own separate alert — the first is never touched by it.
- **Ongoing-condition types** (`NEGATIVE_STOCK`, `SYNC_DRIFT`, `STORE_STATE_CONTRADICTION`, `STOCKOUT_RISK`): keyed stably per product/store, since the condition is a persistent state, not a moment.

**Auto-resolve applies only to the four ongoing-condition types.** If a run no longer detects that `dedupeKey`, the alert is marked `RESOLVED`. `STOCK_DROP` is deliberately excluded from this: its detector only looks back 24 hours, so every stock-drop alert would naturally age out of that window within ~4 cron cycles regardless of whether anyone saw it — auto-resolving on "no longer detected" would silently close it for the wrong reason. `STOCK_DROP` alerts stay `OPEN` until a human dismisses them.

**Manual dismiss** is supported from the UI (`/alerts`) for any `OPEN` alert. Dismissing doesn't fix anything — it's an acknowledgment, not a remediation.

**Dismiss-and-recur is handled explicitly, not left to default behavior:** if a dismissed alert's underlying condition is still present on a later run, the reconcile step reopens the _same_ document (clearing `dismissedAt`, refreshing `dataPoints`/severity, regenerating reasoning) rather than creating a second document with the same `dedupeKey`. Without this, dismissing an unresolved ongoing condition would silently fragment its history across multiple documents every 6 hours.

Alerts whose `dataPoints`/severity are unchanged from the previous run are intended to skip both the database write and the reasoning regeneration, to avoid burning an LLM call re-explaining numbers that haven't moved — this comparison is currently a `JSON.stringify` equality check between the freshly computed candidate and the existing document's stored value.

## Cost Per Run

Cost scales with the number of _batches_, not the number of anomalies directly — up to 20 anomalies needing reasoning are grouped into a single `generateText` call (`REASONING_BATCH_SIZE`), so a typical run (single-digit alert count) makes exactly one small structured-output call. Exact per-run cost is tracked in Langfuse (`functionId: anomaly-reasoning-agent`) rather than estimated here — same approach as Feature 1's `costNote`, pointing to the observability tool that already measures this accurately instead of maintaining a second, easily-stale cost calculation in code or docs.

## Known Limitations

- **All thresholds are reasoned defaults calibrated against synthetic seed data, not real production traffic** — the 30%/5-unit stock-drop floor, the 12h/24h/48h sync-drift tiers, the 7-day/3-day/1-day stockout-risk tiers, and the 3-order minimum sample size for trusting a velocity figure. Same caveat class as the RAG pipeline's `CONFIDENCE_THRESHOLD`: stated explicitly rather than silently assumed correct, and worth revisiting once real usage data exists.
- **The reasoning grounding check verifies topical relevance, not full numeric correctness** — it confirms the model's text mentions the right SKU/store, not that every number in the sentence is accurate. The deterministic fallback template is the actual correctness guarantee when it fires; the grounding check is a floor, not a complete verifier.
- **Known N+1 query patterns** in `detectSyncDrift` (2 queries per active store) and the reconcile step's per-candidate DB round-trips — acceptable at current alert volumes, would need to become real bulk operations at higher scale.
- **`Product.recentSalesVelocity` / `stockoutRisk` / `lastRiskAnalysis` fields were removed entirely** (not deprecated in place) once nothing read or wrote them anymore — a frozen, silently-stale field in a live UI was judged worse than removing it and rebuilding the one feature that depended on it (the products-page badge) against live `Alert` data instead.

## Replaces `smartStockoutCheck`

The prior daily cron (`lib/inngest/functions/smartStockout.ts`) is fully removed. It used the raw `@google/generative-ai` SDK directly (not the Vercel AI SDK), had no Langfuse tracing, no model fallback, and let Gemini decide risk from a bare `responseSchema` with no downstream validation of correctness — the same class of pattern this feature's code-detects/LLM-explains split was built to avoid repeating. Its one useful piece of logic (14-day sales velocity aggregation) was carried forward into `detectStockoutRisk`, corrected to count only genuine `ORDER_FULFILLMENT` sales events with a minimum sample size, rather than any negative ledger change.
