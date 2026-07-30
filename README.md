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
