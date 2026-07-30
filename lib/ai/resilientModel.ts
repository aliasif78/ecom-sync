// ==========================================
// 🔎 CONTEXT
// ==========================================
//
// Model fallback for Feature 1, implemented as LANGUAGE-MODEL MIDDLEWARE
// (wrapLanguageModel + custom wrapStream/wrapGenerate), not a call-site
// try/catch wrapper.
//
// ⚠️ WHY NOT A TRY/CATCH WRAPPER (the Week 8 `generateWithFallback` shape):
// That pattern works for `generateText` because the whole call is one
// promise — catch it, retry with a different model, done. It does NOT
// port to `streamText`: by the time an error surfaces, the stream may
// already be flowing to the client, and you cannot silently swap models
// mid-response without the client seeing a broken/restarted stream.
//
// Middleware avoids this entirely because it sits BELOW streamText/
// generateText, at the raw model level. `doStream()` either succeeds and
// returns a stream object (which streamText then consumes and forwards),
// or it throws BEFORE any tokens have been produced — the middleware
// catches that pre-generation failure and swaps in the fallback model's
// doStream() instead. From streamText's perspective, and the client's,
// this is indistinguishable from the primary model just working normally.
//
// ⚠️ KNOWN LIMITATION — documented, not hidden: this only catches failures
// that occur BEFORE generation starts (bad API key, rate limit, model
// not found/deprecated, network unreachable — the overwhelming majority
// of real-world failures). It does NOT handle a connection dropping
// MID-STREAM after tokens have already been sent to the client — at that
// point, chunks are already in flight and there's no clean way to splice
// in a different model without the client seeing a visibly broken
// response. That's a fundamentally harder problem (buffering + replay or
// accepting a truncated response) and is out of scope here.
//
// ⚠️ ERROR CLASSIFICATION — the actual rule, and why:
//   - 401 / 403 (auth failure)     → DO NOT fall back. Primary and fallback
//     share the same API key; if the key is bad, the fallback fails
//     identically. Falling back here just burns an extra request for
//     nothing and hides the real problem (a broken credential).
//   - 400 (malformed request)      → DO NOT fall back. The request itself
//     is broken; a different model receives the same broken request and
//     fails the same way.
//   - 404 (model not found/deprecated) → DO fall back. This is specific to
//     the PRIMARY MODEL'S ID, not the request or the credentials — exactly
//     the "gemini-2.5-flash no longer available" class of failure. A
//     different model ID is a completely different endpoint and is
//     expected to succeed.
//   - 429 (rate limited) / 5xx (server error) / no status (network)
//     → DO fall back. Transient/overload conditions where a different
//     model (different quota, different infra) is likely to succeed.

// ==========================================
// 📦 Imports
// ==========================================

import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai';
import { google } from '@ai-sdk/google';

// ==========================================
// 💿 CONSTANTS
// ==========================================

const PRIMARY_MODEL_ID = 'gemini-3.1-flash-lite';
// Deliberately a different generation/tier from the primary — reduces the
// chance a single provider-side incident takes out both. Verified GA as of
// this writing; re-check if this ever starts erroring on EVERY call (that
// would mean IT'S also been deprecated, not that fallback is broken).
const FALLBACK_MODEL_ID = 'gemini-2.5-flash';

const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403]);

// ==========================================
// 🔧 ERROR CLASSIFICATION
// ==========================================

/**
 * Duck-types the error rather than checking `instanceof APICallError`.
 * This is deliberately less precise than a proper type guard, but it
 * doesn't depend on importing APICallError from the correct package path
 * for your exact installed AI SDK version — verify that path yourself
 * (see chat) if you want to tighten this later.
 */
function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

function isRetryableError(error: unknown): boolean {
  const statusCode = getStatusCode(error);

  // No status code at all — likely a network-level failure (DNS, timeout,
  // connection refused). Treat as retryable; there's no request/credential
  // to blame here.
  if (statusCode === undefined) return true;

  if (NON_RETRYABLE_STATUS_CODES.has(statusCode)) return false;

  // 404 (model not found), 429 (rate limited), 5xx (server error) — all fall through to true.
  return true;
}

// ==========================================
// 🔧 MIDDLEWARE
// ==========================================

const fallbackMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',

  wrapStream: async ({ doStream, params }) => {
    try {
      return await doStream();
    } catch (error) {
      if (!isRetryableError(error)) throw error;

      console.warn(`⚠️ [MODEL_FALLBACK] Primary model "${PRIMARY_MODEL_ID}" failed on stream (status: ${getStatusCode(error) ?? 'network'}). Falling back to "${FALLBACK_MODEL_ID}".`, error);

      const fallbackModel = google(FALLBACK_MODEL_ID);
      return await fallbackModel.doStream(params);
    }
  },

  wrapGenerate: async ({ doGenerate, params }) => {
    try {
      return await doGenerate();
    } catch (error) {
      if (!isRetryableError(error)) throw error;

      console.warn(`⚠️ [MODEL_FALLBACK] Primary model "${PRIMARY_MODEL_ID}" failed on generate (status: ${getStatusCode(error) ?? 'network'}). Falling back to "${FALLBACK_MODEL_ID}".`, error);

      const fallbackModel = google(FALLBACK_MODEL_ID);
      return await fallbackModel.doGenerate(params);
    }
  },
};

// ==========================================
// 🚀 EXPORT
// ==========================================

/**
 * Drop-in replacement for `google('gemini-3.1-flash-lite')` — use this
 * anywhere you'd use the raw model, in both streamText and generateText.
 * Transparently falls back to FALLBACK_MODEL_ID on retryable errors.
 */
export const resilientQueryModel = wrapLanguageModel({
  model: google(PRIMARY_MODEL_ID),
  middleware: fallbackMiddleware,
});
