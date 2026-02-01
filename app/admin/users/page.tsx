'use client';

import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';

// --- Types (You will move this to your types folder later) ---
type User = {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'banned';
  lastActive: string;
  profilePicture?: string;
};

// --- Dummy Data (Replace with fetch from DB) ---
const MOCK_USERS: User[] = [
  { id: '1', fullName: 'Alice Johnson', email: 'alice@example.com', role: 'admin', status: 'active', lastActive: '2 mins ago' },
  { id: '2', fullName: 'Bob Smith', email: 'bob@example.com', role: 'user', status: 'active', lastActive: '1 day ago' },
  { id: '3', fullName: 'Charlie Brown', email: 'charlie@example.com', role: 'user', status: 'banned', lastActive: '2 weeks ago' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Filter Users
  const filteredUsers = users.filter((user) => user.fullName.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase()));

  // Handlers
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      // TODO: Call your DELETE API here
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success('User deleted successfully');
    }
  };

  const handleEditClick = (user: User) => {
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
            <span className="block text-2xl font-bold text-green-500">{users.filter((u) => u.status === 'active').length}</span>
            <span className="text-xs tracking-wider text-zinc-500 uppercase">Active</span>
          </div>
        </div>
      </div>

      {/* 2. Controls */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="relative w-full max-w-sm">
          <svg className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pr-4 pl-10 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
        </div>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">+ Add User</button>
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
              <tr key={user.id} className="group transition-colors hover:bg-zinc-800/50">
                {/* User Column */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-500">{user.profilePicture ? <Image src={user.profilePicture} alt="user profile picture" className="h-full w-full object-cover" /> : <span className="font-bold">{user.fullName.charAt(0)}</span>}</div>
                    <div>
                      <div className="font-medium text-white">{user.fullName}</div>
                      <div className="text-zinc-500">{user.email}</div>
                    </div>
                  </div>
                </td>

                {/* Role Column */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${user.role === 'admin' ? 'border-purple-500/20 bg-purple-500/10 text-purple-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>{user.role}</span>
                </td>

                {/* Status Column */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${user.status === 'active' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                    {user.status}
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
                    <button onClick={() => handleDelete(user.id)} className="rounded p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300">
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
                <input defaultValue={selectedUser.fullName} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:outline-none" />
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
    </div>
  );
}
