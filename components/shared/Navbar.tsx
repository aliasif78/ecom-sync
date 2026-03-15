'use client';

// React
import { useState } from 'react';

// Next Js
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Types
import { User } from '@supabase/supabase-js';

// Shadcn
import { toast } from 'sonner';

// Components
import LogoutButton from '../auth/LogoutButton';

// Interfaces
interface NavbarProps {
  user: User | null;
  initialChaos: boolean;
}

export default function Navbar({ user, initialChaos }: NavbarProps) {
  const pathname = usePathname();
  const [chaosMode, setChaosMode] = useState(initialChaos);

  // 🐒 The Trigger Logic
  const toggleChaos = () => {
    const newState = !chaosMode;
    setChaosMode(newState);

    if (newState) {
      // Set cookie for 1 day - Server Actions will look for this
      document.cookie = 'chaos_mode=true; path=/; max-age=86400';
      toast.error('🐒 Chaos Mode Activated! APIs will now randomly fail.');
    } else {
      // Delete cookie
      document.cookie = 'chaos_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      toast.success('🛡️ Chaos Mode Deactivated. Systems normal.');
    }
  };

  // 🚫 Blacklist: Paths where the Navbar should NOT appear
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth');
  if (isAuthPage) return null;

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* 1. Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              Ecom<span className="text-blue-500">Sync</span>
            </span>
          </Link>

          {/* 2. Middle Navigation */}
          {user && (
            <div className="hidden items-center gap-1 md:flex">
              {['products', 'stores'].map((path) => (
                <NavLink key={path} href={'/' + path} active={pathname === '/' + path}>
                  {path.charAt(0).toUpperCase() + path.slice(1)}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* 3. User Actions */}
        <div className="flex items-center gap-6">
          {user ? (
            <>
              {/* 🐒 CHAOS TOGGLE */}
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
                <span className="text-xs font-semibold text-zinc-400">CHAOS</span>

                <button onClick={toggleChaos} title="Toggle Chaos Mode (Simulate 500 Errors)" className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${chaosMode ? 'bg-red-500' : 'bg-zinc-700'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${chaosMode ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* User Info */}
              <div className="hidden flex-col items-end md:flex">
                <span className="text-xs font-medium text-zinc-200">{user.user_metadata.full_name || 'User'}</span>
                <span className="text-xs text-zinc-500">{user.email}</span>
              </div>

              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
              Get Started
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

// Helper: Active Link with "Pill" design (Dark Mode Version)
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${active ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
      {children}
    </Link>
  );
}
