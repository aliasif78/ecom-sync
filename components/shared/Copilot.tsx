'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { PiSparkleFill } from 'react-icons/pi'; // Assuming you have this installed

// 🛡️ TS FIX: Define the shape of our incoming data so we don't use 'any'
interface ProductState {
  sku: string;
  stock: number;
  name?: string;
}

export default function Copilot() {
  const [input, setInput] = useState('');

  // 1. ⚡ FIX: Remove the 'api' config. AI SDK 5+ defaults to '/api/chat' automatically via the new transport layer.
  const { messages, sendMessage, status } = useChat();

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

      {/* 💬 CHAT HISTORY */}
      <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 z-10 flex-1 overflow-y-auto pr-2 pb-4">
        {messages.length === 0 && (
          <div className="mt-20 flex flex-col items-center justify-center gap-3 text-center opacity-70 transition-opacity hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
              <PiSparkleFill className="h-6 w-6 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-slate-400">
              Ask me about your inventory
              <br />
              or tell me to sync a product.
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

                // B. Render Tools
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

        {/* 4. ⚡ THINKING STATE: Glowing animation instead of dull text */}
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
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Copilot a question..." disabled={status === 'streaming' || status === 'submitted'} className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all outline-none focus:border-indigo-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50" />
        <button type="submit" disabled={!input.trim() || status === 'streaming' || status === 'submitted'} className="group flex items-center justify-center rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:pointer-events-none disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
