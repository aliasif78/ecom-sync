'use client';

// React
import { useState } from 'react';

// Components
import { Table } from '@/components/shared/Table';
import { ActionButton, Icons } from '@/components/shared/TableActions';

// Types
import { StoreRow } from '@/types/index';

// Contexts
import { useStoreModals } from '@/contexts/StoreModalsProvider';

// BE Functions
import { deleteStoreByIdAction } from '@/actions/stores';

// Shadcn
import { toast } from 'sonner';

// Interfaces
interface Props {
  stores: StoreRow[];
}

// Helpers
const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getPlatformStyle = (platform: string) => {
  if (platform === 'SHOPIFY') return { label: 'Shopify', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  if (platform === 'AMAZON') return { label: 'Amazon Mock', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
  if (platform === 'WOOCOMMERCE') return { label: 'WooCommerce', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
  return { label: platform, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' };
};

const StoreTable = ({ stores }: Props) => {
  // States
  const [disableDeleteId, setDisableDeleteId] = useState<string | null>(null);

  // Hooks
  const { openEditStoreModal } = useStoreModals();

  // Functions
  const handleDelete = async (id: string) => {
    if (disableDeleteId === id) return;

    if (confirm('Are you sure you want to disconnect this store? Synchronization will stop immediately.')) {
      setDisableDeleteId(id);
      const res = await deleteStoreByIdAction(id);

      // Success
      if (res.success) toast.success(res.message);
      // Error
      else {
        console.error(res.message);
        toast.error(res.message);
      }

      setDisableDeleteId(null);
    }
  };

  const handleEdit = (store: StoreRow) => openEditStoreModal(store);

  return (
    <Table title="Active Channels" description="Manage your connected e-commerce integrations" recordCount={stores.length} headers={['Store Identity', 'Platform', 'Connection', 'Sync Status', 'Last Activity', 'Actions']}>
      {stores.map((store) => {
        const platformStyle = getPlatformStyle(store.platform);

        return (
          <tr key={store._id} className="group transition-all duration-300 hover:bg-white/5">
            {/* Column 1: Store Identity */}
            <td className="px-8 py-5 whitespace-nowrap">
              <div className="flex items-center gap-4">
                {/* Platform Initials Icon */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-lg font-bold shadow-inner ${platformStyle.color.split(' ')[1]}`}>
                  <span className={platformStyle.color.split(' ')[0]}>{store.platform[0]}</span>
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-100">{store.name}</div>
                  <div className="mt-1 font-mono text-xs tracking-wider text-slate-500 uppercase">ID: ...{store._id.slice(-6)}</div>
                </div>
              </div>
            </td>

            {/* Column 2: Platform Badge */}
            <td className="px-8 py-5 whitespace-nowrap">
              <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${platformStyle.color}`}>{platformStyle.label}</span>
            </td>

            {/* Column 3: Connection Status */}
            <td className="px-8 py-5 whitespace-nowrap">
              {store.isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-medium text-emerald-400">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  <span className="text-sm font-medium text-red-400">Disconnected</span>
                </div>
              )}
            </td>

            {/* Column 4: Sync Status (Switch Logic) */}
            <td className="px-8 py-5 whitespace-nowrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ring-1 ${store.isSyncEnabled ? 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30' : 'bg-slate-700/50 text-slate-400 ring-slate-600'}`}>{store.isSyncEnabled ? 'Auto-Sync Active' : 'Paused'}</span>
            </td>

            {/* Column 5: Last Activity */}
            <td className="px-8 py-5 text-sm whitespace-nowrap text-slate-400">{formatDate(store.lastSyncAt)}</td>

            {/* Column 6: Actions */}
            <td className="px-8 py-5 text-right text-sm font-medium whitespace-nowrap">
              <div className="flex items-center justify-end gap-3">
                <ActionButton icon={<Icons.Edit />} onClick={() => handleEdit(store)} title="Configure Store" />
                <ActionButton icon={<Icons.Delete />} onClick={() => handleDelete(store._id)} variant="danger" title="Remove Connection" disabled={disableDeleteId === store._id} />
              </div>
            </td>
          </tr>
        );
      })}
    </Table>
  );
};

export default StoreTable;
