'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { PiSparkleFill } from 'react-icons/pi'; // Assuming you have this installed

// Types — importing the actual server-side output type (type-only, erased at
// compile time) so the frontend shape can never silently drift from what the
// backend actually returns.
import type { QueryInventoryToolOutput } from '@/lib/inventory/queryInventoryTool';

// 🛡️ TS FIX: Define the shape of our incoming data so we don't use 'any'
interface ProductState {
  sku: string;
  stock: number;
  name?: string;
}

// ==========================================
// 🔎 CONTEXT — Ask vs Act split
// ==========================================
//
// Two fully separate useChat instances, pointed at two separate routes:
//   - "Ask"  → /api/chat/query — read-only, Feature 1. Cannot mutate anything.
//   - "Act"  → /api/chat       — the original mutation copilot, unchanged.
//
// This mirrors the Phase 0 decision to keep query and mutation surfaces
// architecturally separate — a misparsed query can never reach a
// stock-mutating tool, because the tool literally isn't in that route's
// tool set. Each mode keeps its own independent message history; switching
// tabs doesn't lose either conversation.

type Mode = 'ask' | 'act';

// ==========================================
// 🔧 Sub-component: queryInventory results renderer
// ==========================================

/** Human-readable label for the resolvedParams summary line above the table. */
function describeQuery(params: QueryInventoryToolOutput['resolvedParams']): string {
  const platformLabel = params.platform === 'all' ? '' : ` on ${params.platform}`;

  switch (params.condition) {
    case 'outOfStock': {
      const duration = params.minDurationDays ? ` for ${params.minDurationDays}+ days` : '';
      return `Out of stock${platformLabel}${duration}`;
    }
    case 'lowStock': {
      const duration = params.minDurationDays ? ` for ${params.minDurationDays}+ days` : '';
      return `Stock at or below ${params.threshold}${platformLabel}${duration}`;
    }
    case 'stockAbove':
      return `Stock above ${params.threshold}${platformLabel}`;
    case 'stockBelow':
      return `Stock below ${params.threshold}${platformLabel}`;
    default:
      return 'Query results';
  }
}

function QueryInventoryResults({ output }: { output: QueryInventoryToolOutput }) {
  const { resolvedParams, count, results } = output;

  return (
    <div className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs shadow-inner">
      <div className="mb-3 flex items-center gap-2 font-bold text-slate-300">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">🔍</span>
        {describeQuery(resolvedParams)}
      </div>

      {/* Explicit zero-results state — never rely on the model's text alone for this. */}
      {count === 0 ? (
        <div className="rounded-md border border-white/5 bg-white/5 px-3 py-2 text-slate-400 italic">No products matched this query.</div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.sku} className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1.5 transition-colors hover:bg-white/10">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-slate-300">{r.sku}</span>
                <span className="truncate text-[10px] text-slate-500">{r.name}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {r.platform !== 'all' && <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">{r.platform}</span>}

                {r.daysInCondition !== undefined && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">{r.daysInCondition}d</span>}

                <span className={`font-semibold ${r.stock === 0 ? 'text-rose-400' : r.stock < 10 ? 'text-amber-400' : 'text-emerald-400'}`}>{r.stock} units</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 🚀 Main component
// ==========================================

export default function Copilot() {
  const [mode, setMode] = useState<Mode>('ask');
  const [input, setInput] = useState('');

  // "Ask" — read-only Feature 1 route.
  const ask = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat/query' }),
  });

  // "Act" — original mutation copilot. Default transport already points at
  // /api/chat (AI SDK's default), unchanged from the original implementation.
  const act = useChat();

  const active = mode === 'ask' ? ask : act;
  const { messages, sendMessage, status } = active;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const textToSubmit = input;
    setInput('');

    await sendMessage({ text: textToSubmit });
  };

  return (
    // 2. ⚡ THE CONTAINER: Glassmorphism, deep gradients, and a subtle glowing shadow
    <div className="relative flex h-125 w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-[0_0_40px_rgba(99,102,241,0.15)] backdrop-blur-xl">
      {/* Optional: Subtle background glowing orb to sell the "magic" */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-[80px]"></div>

      {/* 🔀 MODE TOGGLE */}
      <div className="z-10 mb-3 flex gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1">
        <button type="button" onClick={() => setMode('ask')} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${mode === 'ask' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          🔍 Ask
        </button>
        <button type="button" onClick={() => setMode('act')} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${mode === 'act' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
          ⚡ Act
        </button>
      </div>

      {/* 💬 CHAT HISTORY */}
      <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 z-10 flex-1 overflow-y-auto pr-2 pb-4">
        {messages.length === 0 && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center opacity-70 transition-opacity hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
              <PiSparkleFill className="h-6 w-6 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">
              {mode === 'ask' ? (
                <>
                  Ask about your inventory —
                  <br />
                  read-only, no changes made.
                </>
              ) : (
                <>
                  Tell me to update stock
                  <br />
                  or trigger a sync.
                </>
              )}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`mb-6 flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="mb-1.5 ml-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {m.role === 'user' ? (
                'You'
              ) : (
                <>
                  <PiSparkleFill className="h-3 w-3 text-indigo-400" /> Copilot
                </>
              )}
            </span>

            {/* 3. ⚡ BUBBLE STYLING: Differentiating user vs AI with rich textures */}
            <div className={`max-w-[90%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm transition-all ${m.role === 'user' ? 'rounded-tr-sm bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/20' : 'rounded-tl-sm border border-white/5 bg-white/5 text-slate-200 backdrop-blur-md'}`}>
              {m.parts?.map((part, index) => {
                // A. Render Standard Text
                if (part.type === 'text') {
                  return <span key={index}>{part.text}</span>;
                }

                // B. Render Tools — Ask mode: read-only query results
                if (part.type === 'tool-queryInventory') {
                  if (part.state === 'output-available') {
                    return <QueryInventoryResults key={index} output={part.output as QueryInventoryToolOutput} />;
                  }
                  // Loading State
                  return (
                    <div key={index} className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-400">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400"></div>
                      Querying inventory...
                    </div>
                  );
                }

                // C. Render Tools — Act mode: existing mutation copilot tools (unchanged)
                if (part.type === 'tool-getInventoryStatus') {
                  // We only render the data if the backend has finished streaming the output
                  if (part.state === 'output-available') {
                    // 3. ⚡ FIX: Cast the unknown output to our specific types
                    const { products } = part.output as { products: ProductState[] };

                    return (
                      <div key={index} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs shadow-inner">
                        <div className="mb-3 flex items-center gap-2 font-bold text-slate-300">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">📊</span>
                          Found {products?.length || 0} products:
                        </div>
                        <div className="space-y-2">
                          {products?.map((p) => (
                            <div key={p.sku} className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1.5 transition-colors hover:bg-white/10">
                              <span className="font-mono text-slate-300">{p.sku}</span>
                              <span className={`font-semibold ${p.stock < 5 ? 'text-rose-400' : 'text-emerald-400'}`}>{p.stock} units</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  // Loading State
                  return (
                    <div key={index} className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-400">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400"></div>
                      Querying Master Catalog...
                    </div>
                  );
                }

                // --- TOOL: TRIGGER SYNC ---
                if (part.type === 'tool-updateAndSyncStock') {
                  if (part.state === 'output-available') {
                    const { message } = part.output as { message: string };
                    return (
                      <div key={index} className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 shadow-inner">
                        <span className="mt-0.5">✅</span>
                        <span className="leading-relaxed">{message}</span>
                      </div>
                    );
                  }
                  // Loading State
                  return (
                    <div key={index} className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-400">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400"></div>
                      Dispatching Sync Workers...
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}

        {/* ⚡ THINKING STATE: Glowing animation instead of dull text */}
        {status === 'submitted' && (
          <div className="mb-4 flex flex-col items-start">
            <span className="mb-1.5 ml-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              <PiSparkleFill className="h-3 w-3 animate-pulse text-indigo-400" /> Copilot
            </span>
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-white/5 bg-white/5 px-4 py-3 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0ms' }}></div>
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '150ms' }}></div>
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ⌨️ INPUT FORM: Glassy input and glowing button */}
      <form onSubmit={onSubmit} className="z-10 mt-2 flex gap-2 border-t border-white/10 pt-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === 'ask' ? 'Ask about your inventory...' : 'Tell Copilot to update or sync...'} disabled={status === 'streaming' || status === 'submitted'} className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all outline-none focus:border-indigo-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50" />
        <button type="submit" disabled={!input.trim() || status === 'streaming' || status === 'submitted'} className="group flex items-center justify-center rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:pointer-events-none disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
