'use client';

// React
import { useState } from 'react';

// Next Js
import { useRouter } from 'next/navigation';

// Server Actions
import { logout } from '@/actions/auth';

// Shadcn
import { toast } from 'sonner';

export default function LogoutButton() {
  // States
  const [loading, setLoading] = useState(false);

  // Router
  const router = useRouter();

  // Functions
  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await logout();
      toast.success(res.message || 'Logged out successfully');
      router.push('/login'); // 👈 Navigate securely
      router.refresh(); // 👈 Ensure all server data (Navbar user) is cleared
    } catch (error) {
      toast.error('Failed to logout');
      setLoading(false);
      console.error(error);
    }
  };

  return (
    <button onClick={handleLogout} disabled={loading} className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10">
      {loading ? 'Logging out...' : 'Sign Out'}
    </button>
  );
}
