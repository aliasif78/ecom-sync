'use client';

// Next Js
import Image from 'next/image';

// React
import { useState } from 'react';

// Types
import { UserTableRow } from '@/types';

// Shadcn
import { toast } from 'sonner';
import { ADMIN, NOT_VERIFIED, USER, VERIFIED } from '@/lib/globalConstants';

// Interfaces
interface UserTableProps {
  users: UserTableRow[];
}

const UserTable = ({ users }: UserTableProps) => {
  // States
  const [search, setSearch] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserTableRow | null>(null);

  // Rendering Constants
  const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase()));

  // Handlers
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      toast.success('User deleted successfully');
    }
  };

  const handleEditClick = (user: UserTableRow) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Call your UPDATE API here
    toast.success('User updated successfully');
    setIsEditOpen(false);
  };

  return (
    <>
      {/* 2. Controls */}
      <div className="relative mb-6 flex w-full max-w-sm items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <svg className="absolute top-1/2 left-7.5 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pr-4 pl-10 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
      </div>

      {/* 3. The Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-950 text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Last Active</th>
              <th className="px-6 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800">
            {filteredUsers.map((user) => (
              <tr key={user._id} className="group transition-colors hover:bg-zinc-800/50">
                {/* User Column */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-500">{user.profilePicture ? <Image src={user.profilePicture} alt={user.name} objectFit="cover" width={40} height={40} /> : <span className="font-bold">{user.name.charAt(0)}</span>}</div>
                    <div>
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-zinc-500">{user.email}</div>
                    </div>
                  </div>
                </td>

                {/* Role Column */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${user.role === ADMIN ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-green-700/50 bg-green-950 text-green-400'}`}>{user.role || USER}</span>
                </td>

                {/* Status Column */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${user.status === VERIFIED ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${user.status === VERIFIED ? 'bg-green-400' : 'bg-red-400'}`} />
                    {user.status || NOT_VERIFIED}
                  </span>
                </td>

                {/* Last Active */}
                <td className="px-6 py-4 text-zinc-500">{user.lastActive}</td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => handleEditClick(user)} className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(user._id)} className="rounded p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && <div className="p-12 text-center text-zinc-500">No users found matching &quot;{search}&quot;</div>}
      </div>

      {/* 4. Edit User Modal (Simple Overlay) */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl duration-200">
            <h2 className="mb-6 text-xl font-bold text-white">Edit User</h2>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Full Name</label>
                <input defaultValue={selectedUser.name} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
                <input defaultValue={selectedUser.email} disabled className="w-full cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-zinc-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Role</label>
                  <select defaultValue={selectedUser.role} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:outline-none">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Status</label>
                  <select defaultValue={selectedUser.status} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:outline-none">
                    <option value="active">Active</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UserTable;
