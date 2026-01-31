'use client';

// Next Js
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Types
import { User } from '@supabase/supabase-js';

// Components
import LogoutButton from './auth/LogoutButton';

// Interfaces
interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  // 🚫 Blacklist: Paths where the Navbar should NOT appear
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth');
  if (isAuthPage) return null;

  return (
    // DARK MODE: bg-zinc-950, border-zinc-800
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* 1. Logo */}
        <div className="flex items-center gap-8">
          <Link href={user ? '/products' : '/'} className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              Ecomm<span className="text-blue-500">Sync</span>
            </span>
          </Link>

          {/* 2. Middle Navigation (Only visible if logged in) */}
          {user && (
            <div className="hidden items-center gap-1 md:flex">
              {['products', 'inventory', 'orders'].map((path) => (
                <NavLink key={path} href={'/' + path} active={pathname === '/' + path}>
                  {path.charAt(0).toUpperCase() + path.slice(1)}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* 3. User Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden flex-col items-end md:flex">
                {/* DARK MODE: Text colors inverted */}
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
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-blue-500/10 text-blue-400' // Glowing blue background for active
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white' // Subtle hover for inactive
      }`}>
      {children}
    </Link>
  );
}
