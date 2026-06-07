'use client';

// React
import { useEffect, useRef } from 'react';

// Pusher
import Pusher from 'pusher-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the `store-verified` Pusher event payload. */
interface StoreVerifiedPayload {
  storeId: string;
  isConnected: boolean;
  message: string;
}

interface Props {
  /** The authenticated user's MongoDB ObjectId string — used as the Pusher channel name. */
  userId: string;
  /**
   * Called when a `store-verified` event arrives.
   * StoreTable uses this to flip `isConnected` in local state without a page refresh.
   */
  onStoreVerified: (storeId: string, isConnected: boolean, message: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Invisible subscriber component that listens on the user's Pusher channel
 * for `store-verified` events emitted by the `verifyStoreConnection` Inngest job.
 *
 * Renders nothing — purely side-effectful. Follows the same pattern as
 * `components/products/SyncPusher.tsx`.
 *
 * The callback ref pattern is used so the Pusher subscription is only
 * created/torn-down when `userId` changes (not on every parent re-render),
 * while still always calling the latest version of `onStoreVerified`.
 */
const StorePusher = ({ userId, onStoreVerified }: Props) => {
  // Stable ref so the Pusher event handler always calls the latest callback
  // without requiring it as a useEffect dependency (which would recreate the
  // subscription on every render).
  const callbackRef = useRef(onStoreVerified);
  useEffect(() => {
    callbackRef.current = onStoreVerified;
  }, [onStoreVerified]);

  useEffect(() => {
    if (!userId) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(userId);

    channel.bind('store-verified', (data: StoreVerifiedPayload) => {
      callbackRef.current(data.storeId, data.isConnected, data.message);
    });

    // Cleanup: unbind and disconnect when the component unmounts or userId changes
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(userId);
      pusher.disconnect();
    };
  }, [userId]); // Only recreate the Pusher connection when userId changes

  return null;
};

export default StorePusher;
