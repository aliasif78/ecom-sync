'use server';

// React
import { ReactNode } from 'react';

// Dependencies
import { streamUI } from 'ai/rsc';
import { google } from '@ai-sdk/google';

// Define the shape of our chat state to hold React components
export interface ServerMessage {
  role: 'user' | 'assistant';
  display: ReactNode;
}

export async function submitUserMessage(userInput: string) {
  'use server';

  const result = await streamUI({
    // We use your existing Gemini Flash preference for low latency
    model: google('gemini-2.5-flash-lite'),

    // The Master Prompt: Give it a personality and strict boundaries
    system: `You are the EcommSync Copilot, an elite inventory management AI. 
    You are direct, concise, and highly analytical. 
    Do not use filler words. If you do not know the answer, say so.`,

    prompt: userInput,

    // How the AI responds when it just wants to talk (Text Fallback)
    text: ({ content }: { content: string }) => {
      return <div className="prose prose-sm prose-invert text-slate-300">{content}</div>;
    },

    // 🛠️ The Toolbelt: We will inject our Zod schemas and React components here in Step 2
    tools: {},
  });

  // Return the streamed UI node directly to the client
  return { id: Date.now(), display: result.value };
}
