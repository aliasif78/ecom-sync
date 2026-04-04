'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

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
    <div className="flex h-125 w-full flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
      {/* 💬 CHAT HISTORY */}
      <div className="flex-1 overflow-y-auto pr-2 pb-4">
        {messages.length === 0 && <div className="mt-10 text-center text-sm text-slate-500">Ask me about your inventory or tell me to sync a product.</div>}

        {messages.map((m) => (
          <div key={m.id} className={`mb-4 flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="mb-1 text-xs font-bold text-slate-500">{m.role === 'user' ? 'You' : 'Copilot'}</span>

            <div className={`max-w-[90%] rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
              {m.parts?.map((part, index) => {
                // A. Render Standard Text
                if (part.type === 'text') {
                  return <span key={index}>{part.text}</span>;
                }

                // 2. ⚡ FIX: Use the dynamic tool type directly on the part object
                // --- TOOL: INVENTORY STATUS ---
                if (part.type === 'tool-getInventoryStatus') {
                  // We only render the data if the backend has finished streaming the output
                  if (part.state === 'output-available') {
                    // 3. ⚡ FIX: Cast the unknown output to our specific types
                    const { products } = part.output as { products: ProductState[] };

                    return (
                      <div key={index} className="mt-2 w-full rounded border border-slate-600 bg-slate-900 p-2 text-xs">
                        <div className="mb-2 font-bold text-slate-400">📊 Found {products?.length || 0} products:</div>
                        {products?.map((p) => (
                          <div key={p.sku} className="flex justify-between border-b border-slate-700/50 py-1 last:border-0">
                            <span className="font-medium text-slate-300">{p.sku}</span>
                            <span className={p.stock < 5 ? 'text-red-400' : 'text-emerald-400'}>{p.stock} in stock</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  // Loading State
                  return (
                    <div key={index} className="mt-2 animate-pulse text-xs text-blue-400">
                      Querying Master Catalog...
                    </div>
                  );
                }

                // --- TOOL: TRIGGER SYNC ---
                if (part.type === 'tool-triggerManualSync') {
                  if (part.state === 'output-available') {
                    const { message } = part.output as { message: string };
                    return (
                      <div key={index} className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-400">
                        ✅ {message}
                      </div>
                    );
                  }
                  // Loading State
                  return (
                    <div key={index} className="mt-2 animate-pulse text-xs text-blue-400">
                      Dispatching Inngest Workers...
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}

        {status === 'submitted' && <div className="mt-2 animate-pulse text-xs text-slate-500">Copilot is thinking...</div>}
      </div>

      {/* ⌨️ INPUT FORM */}
      <form onSubmit={onSubmit} className="mt-2 flex gap-2 border-t border-slate-700 pt-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a command..." disabled={status === 'streaming' || status === 'submitted'} className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50" />
        <button type="submit" disabled={!input.trim() || status === 'streaming' || status === 'submitted'} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400">
          Send
        </button>
      </form>
    </div>
  );
}
