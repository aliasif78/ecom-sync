// Next Js
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

// Shadcn
import { Toaster } from 'sonner';

// Styles
import './globals.css';

// Fonts
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

// Metadata
export const metadata: Metadata = { title: 'EcomSync | Inventory Master', description: 'Real-time inventory synchronization across Shopify, Amazon, and WooCommerce.', icons: { icon: '/favicon.ico' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 font-sans text-slate-900 antialiased`}>
        <main>{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
