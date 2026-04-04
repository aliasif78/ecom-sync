export const dynamic = 'force-dynamic';

// Components
import UserTable from '../components/UserTable';

// Constants
import { VERIFIED } from '@/lib/globalConstants';

// Server Actions
import { getAllUsers } from '@/lib/users';

export default async function AdminUsersPage() {
  // Server Actions
  const { success, users, message } = await getAllUsers();
  if (!success) return <p>{message}</p>;

  return (
    <div className="min-h-screen bg-zinc-950 p-8 pt-30 text-zinc-200">
      {/* 1. Header & Stats */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-zinc-400">Manage access and update user details.</p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-center">
            <span className="block text-2xl font-bold text-white">{users.length}</span>
            <span className="text-xs tracking-wider text-zinc-500 uppercase">Total Users</span>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-center">
            <span className="block text-2xl font-bold text-green-500">{users.filter((u) => u.status === VERIFIED).length}</span>
            <span className="text-xs tracking-wider text-zinc-500 uppercase">Verified</span>
          </div>
        </div>
      </div>

      {/* 2. User Table */}
      <UserTable users={users} />
    </div>
  );
}
