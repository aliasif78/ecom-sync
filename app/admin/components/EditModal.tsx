// Constants
import { ADMIN, USER } from '@/lib/globalConstants';

// Types
import { UserTableRow } from '@/types';

// Dependencies
import { toast } from 'sonner';

// Actions
import { updateUser } from '@/actions/admin/users';

// Interfaces
interface props {
  selectedUser: UserTableRow;
  name: string;
  setName: (name: string) => void;
  role: string;
  setRole: (role: string) => void;
  setIsEditOpen: (isEditOpen: boolean) => void;
  setSelectedUser: (selectedUser: UserTableRow | null) => void;
}

const EditModal = ({ selectedUser, name, setName, role, setRole, setIsEditOpen, setSelectedUser }: props) => {
  // Functions
  const handleSaveUser = async (e: React.FormEvent) => {
    if (!selectedUser) return; // Safety Check
    e.preventDefault();

    // Update user
    const { success, message } = await updateUser(selectedUser._id, name || selectedUser.name, role);

    // Success
    if (success) toast.success('User updated successfully');
    // Error
    else toast.error(message);

    // Close the modal
    closeModal();
  };

  const closeModal = () => {
    setIsEditOpen(false);
    setSelectedUser(null);
    setName('');
    setRole('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl duration-200">
        <h2 className="mb-6 text-xl font-bold text-white">Edit User</h2>

        <form onSubmit={handleSaveUser} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:outline-none" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
            <input defaultValue={selectedUser.email} disabled className="w-full cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-zinc-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:outline-none">
                <option value={USER}>User</option>
                <option value={ADMIN}>Admin</option>
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
            <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
