'use client';

// Next Js
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Components
import LogoutButton from './auth/LogoutButton';

export default function Navbar() {
  // Hooks
  const pathname = usePathname();

  // 🚫 Blacklist: Paths where the Navbar should NOT appear
  // We use .startsWith() to cover /login, /login/reset-password, etc.
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth');
  if (isAuthPage) return null;

  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-blue-600">
            EcommSync
          </Link>

          {/* Navigation Links */}
          <div className="hidden items-center gap-6 md:flex">
            {['products', 'inventory', 'orders'].map((path) => (
              <NavLink key={path} href={'/' + path} active={pathname === '/' + path}>
                {path.slice(0, 1).toUpperCase() + path.slice(1)}
              </NavLink>
            ))}
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-4">
          {/* User email */}
          <div className="hidden text-sm text-gray-500 md:block">johndoe@example.com</div>

          {/* Logout */}
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}

// Helper Component for styling active links
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`text-sm font-medium transition-colors ${active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>
      {children}
    </Link>
  );
}
