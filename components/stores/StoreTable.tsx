'use client';

// React
import { useState, useCallback } from 'react';

// Components
import { Table } from '@/components/shared/Table';
import { ActionButton, Icons } from '@/components/shared/TableActions';
import StorePusher from '@/components/stores/StorePusher';
import StorePagination from '@/components/stores/StorePagination';

// Types
import { StoreRow } from '@/types/index';
import { StoresPaginationInfo } from '@/lib/stores';

// Contexts
import { useStoreModals } from '@/contexts/StoreModalsProvider';

// Server actions
import { deleteStoreByIdAction } from '@/actions/stores';

// Shadcn
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  stores: StoreRow[];
  /** The authenticated user's MongoDB ObjectId — used as the Pusher channel key. */
  userId: string;
  /**
   * BE-computed pagination metadata for the whole store collection — see
   * lib/stores/index.ts's getStoresByUserId. `stores` above is only the
   * current page's slice; `pagination.totalCount` is the true total.
   */
  pagination: StoresPaginationInfo;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats an ISO date string for the "Last Activity" column. */
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Returns Tailwind colour classes and a display label for a given platform. */
const getPlatformStyle = (platform: string) => {
  if (platform === 'SHOPIFY') return { label: 'Shopify', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  if (platform === 'AMAZON') return { label: 'Amazon Mock', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
  if (platform === 'WOOCOMMERCE') return { label: 'WooCommerce', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
  return { label: platform, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' };
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated "Online" badge with a pulsing dot. */
const OnlineBadge = () => (
  <div className="flex items-center gap-2">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
    <span className="text-sm font-medium text-emerald-400">Online</span>
  </div>
);

/** Static "Disconnected" badge. */
const DisconnectedBadge = () => (
  <div className="flex items-center gap-2">
    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
    <span className="text-sm font-medium text-red-400">Disconnected</span>
  </div>
);

/** Animated amber "Verifying…" badge shown while Inngest validates credentials. */
const VerifyingBadge = () => (
  <div className="flex items-center gap-2">
    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
    <span className="text-sm font-medium text-amber-400">Verifying…</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the store list as a data table with real-time connection status.
 *
 * State strategy:
 *
 * - `stores` prop is used directly for rendering — no local mirror of the list.
 *
 * - `connectionOverrides` holds real-time `isConnected` values from Pusher
 *   `store-verified` events, keyed by storeId. Merged at render time:
 *   `connectionOverrides[store._id] ?? store.isConnected`.
 *
 * - `initiallyDisconnectedIds` is a frozen Set (lazy useState, setter never
 *   called) of storeIds that were already `isConnected: false` on mount.
 *   These are legitimately failed/old stores → "Disconnected" badge.
 *
 *   ⚠️ Because this snapshot is only computed on first mount, this
 *   component MUST be remounted whenever `stores` changes to a genuinely
 *   different set (e.g. a pagination page change) — otherwise stores from
 *   a newly-loaded page that aren't in the stale snapshot would incorrectly
 *   render "Verifying…" instead of "Disconnected". The parent
 *   (app/stores/page.tsx) forces this via `key={page}` on StoreListWrapper.
 *
 * - `isVerifying` is fully derived at render time — no extra state or effects:
 *     isConnected is false
 *     AND the store was not disconnected when the component mounted   ← new store
 *     AND we have not yet received a Pusher result for it             ← still pending
 *   Once the Pusher event arrives, the storeId enters `connectionOverrides`
 *   and `isVerifying` immediately becomes false on the next render.
 */
const StoreTable = ({ stores, userId, pagination }: Props) => {
  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * Real-time `isConnected` overrides from Pusher `store-verified` events.
   * Applied on top of the server-rendered prop: `overrides[id] ?? store.isConnected`.
   */
  const [connectionOverrides, setConnectionOverrides] = useState<Record<string, boolean>>({});

  /**
   * Frozen snapshot of storeIds that were already disconnected when the
   * component first mounted. Initialized once; the setter is never called.
   *
   * Purpose: distinguish "legitimately disconnected" (show "Disconnected")
   * from "just added, waiting on Inngest" (show "Verifying…").
   */
  const [initiallyDisconnectedIds] = useState<Set<string>>(() => new Set(stores.filter((s) => !s.isConnected).map((s) => s._id)));

  /** StoreIds with an in-flight delete request — disables the delete button. */
  const [disableDeleteId, setDisableDeleteId] = useState<string[]>([]);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { openEditStoreModal } = useStoreModals();

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Called by `StorePusher` when the `verifyStoreConnection` Inngest job
   * completes. Writes the result into `connectionOverrides` and fires a toast.
   * Once `connectionOverrides` has an entry for the storeId, `isVerifying`
   * evaluates to false on the next render — no extra state to clear.
   */
  const handleStoreVerified = useCallback((storeId: string, isConnected: boolean, message: string) => {
    setConnectionOverrides((prev) => ({ ...prev, [storeId]: isConnected }));

    if (isConnected) {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (disableDeleteId.includes(id)) return;

    if (confirm('Are you sure you want to disconnect this store? Synchronization will stop immediately.')) {
      setDisableDeleteId((prev) => [...prev, id]);
      const res = await deleteStoreByIdAction(id);

      if (res.success) {
        toast.success(res.message);
      } else {
        console.error(res.message);
        toast.error(res.message);
      }

      setDisableDeleteId((prev) => prev.filter((existingId) => existingId !== id));
    }
  };

  const handleEdit = (store: StoreRow) => openEditStoreModal(store);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Invisible Pusher subscriber — no DOM output, purely side-effectful */}
      <StorePusher userId={userId} onStoreVerified={handleStoreVerified} />

      {/* recordCount is the BE-computed total across ALL pages
          (pagination.totalCount), not stores.length. */}
      <Table title="Active Channels" description="Manage your connected e-commerce integrations" recordCount={pagination.totalCount} headers={['Store Identity', 'Platform', 'Connection', 'Sync Status', 'Last Activity', 'Actions']}>
        {stores.map((store) => {
          const platformStyle = getPlatformStyle(store.platform);

          // Merge server-rendered value with any real-time Pusher override
          const isConnected = connectionOverrides[store._id] ?? store.isConnected;

          /**
           * True when the store is mid-validation — shows "Verifying…" badge.
           *
           * All three conditions must hold:
           *  1. Not connected yet (prop or override says false)
           *  2. Was NOT disconnected when the component mounted → it's a new store
           *  3. No Pusher result has arrived yet → validation still in progress
           *
           * When the Pusher event fires, condition 3 breaks (storeId enters
           * connectionOverrides) and the badge resolves to Online / Disconnected.
           */
          const isVerifying = !isConnected && !initiallyDisconnectedIds.has(store._id) && !(store._id in connectionOverrides);

          return (
            <tr key={store._id} className="group transition-all duration-300 hover:bg-white/5">
              {/* Column 1: Store Identity */}
              <td className="px-8 py-5 whitespace-nowrap">
                <div className="flex items-center gap-4">
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

              {/* Column 3: Connection Status — Verifying → Online / Disconnected */}
              <td className="px-8 py-5 whitespace-nowrap">{isVerifying ? <VerifyingBadge /> : isConnected ? <OnlineBadge /> : <DisconnectedBadge />}</td>

              {/* Column 4: Sync Status */}
              <td className="px-8 py-5 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ring-1 ${store.isSyncEnabled ? 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30' : 'bg-slate-700/50 text-slate-400 ring-slate-600'}`}>{store.isSyncEnabled ? 'Auto-Sync Active' : 'Paused'}</span>
              </td>

              {/* Column 5: Last Activity */}
              <td className="px-8 py-5 text-sm whitespace-nowrap text-slate-400">{formatDate(store.lastSyncAt)}</td>

              {/* Column 6: Actions */}
              <td className="px-8 py-5 text-right text-sm font-medium whitespace-nowrap">
                <div className="flex items-center justify-end gap-3">
                  <ActionButton icon={<Icons.Edit />} onClick={() => handleEdit(store)} title="Configure Store" />
                  <ActionButton icon={<Icons.Delete />} onClick={() => handleDelete(store._id)} variant="danger" disabled={disableDeleteId.includes(store._id)} title="Remove Connection" />
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      <StorePagination pagination={pagination} />
    </div>
  );
};

export default StoreTable;
