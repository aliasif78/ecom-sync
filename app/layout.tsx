// Next Js
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

// Shadcn
import { Toaster } from 'sonner';

// Supabase
import { createClient } from '@/lib/supabase/server';

// Components
import Navbar from '@/components/Navbar';

// Styles
import './globals.css';

// Fonts
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

// Metadata
export const metadata: Metadata = { title: 'EcomSync | Inventory Master', description: 'Real-time inventory synchronization across Shopify, Amazon, and WooCommerce.', icons: { icon: '/favicon.ico' } };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 1. Fetch User on the Server (Instant, no loading state)
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { user } = data;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen bg-zinc-950 font-sans text-slate-50 antialiased`} suppressHydrationWarning>
        {/* ✅ The Navbar sits here. It decides internally whether to show up. */}
        <Navbar user={user} />

        <main className="min-h-screen bg-zinc-950">{children}</main>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
