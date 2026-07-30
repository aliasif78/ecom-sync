// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Next.js instrumentation hook — runs once at server startup, not per-request.
//
// ⚠️ CORRECTED FROM AN EARLIER VERSION OF THIS FILE: your project runs
// ai@6.0.238, NOT AI SDK 7. The registerTelemetryIntegration +
// @langfuse/vercel-ai-sdk approach requires `ai >=7.0.0 <8` as a peer
// dependency and cannot install against this version (confirmed by the
// ERESOLVE error when attempting npm install).
//
// This is the correct path for AI SDK v6: `langfuse-vercel` is a plain
// OpenTelemetry span exporter — it doesn't depend on AI SDK's internal
// API surface the way the v7-specific integration does, so it has no
// `ai` peer dependency conflict. `registerOTel` (from @vercel/otel) wires
// standard OpenTelemetry instrumentation into Next.js; any spans the AI
// SDK emits via `experimental_telemetry` (already set in route.ts) get
// picked up and exported to Langfuse automatically.
//
// ⚠️ NEXT.JS SPECIFIC: only one `instrumentation.ts` is allowed at the
// project root (or `src/`). If one already exists, merge `register()`
// bodies rather than creating a second file.
//
// ⚠️ ENV VARS (same as your Week 8 setup): LANGFUSE_SECRET_KEY,
// LANGFUSE_PUBLIC_KEY, LANGFUSE_BASE_URL (not LANGFUSE_BASEURL) — read
// implicitly by LangfuseExporter, no explicit config needed in code.

// ==========================================
// 📦 Imports
// ==========================================

import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';

export function register() {
  // Only run on the Node.js runtime — instrumentation.ts also loads for
  // the Edge runtime in Next.js, where this OTel setup isn't usable.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  registerOTel({
    serviceName: 'ecom-sync-inventory-query',
    traceExporter: new LangfuseExporter(),
  });

  console.log('✅ [TELEMETRY] Langfuse tracing registered (AI SDK v6 path via @vercel/otel).');
}
