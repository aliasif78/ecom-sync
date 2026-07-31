// Server Actions
import { getStoresByUserIdAction } from '@/actions/stores';

// Components
import ErrorMessage from '../shared/ErrorMessage';
import StoreTable from './StoreTable';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Requested page number — parsed/clamped by the parent app/stores/page.tsx
   * from the `?page=` search param, and re-clamped again inside
   * getStoresByUserId. */
  page: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Server component wrapper responsible for fetching one page of stores and
 * passing them to the `StoreTable` client component.
 *
 * Also surfaces `userId` from the action response so `StoreTable` can
 * subscribe to the correct Pusher channel for real-time `store-verified`
 * events — without requiring a separate round-trip to resolve the session user.
 */
const StoreListWrapper = async ({ page }: Props) => {
  const { stores = [], userId = '', success, message, pagination } = await getStoresByUserIdAction(page);

  if (!success || !pagination) return <ErrorMessage message={message} />;

  return <StoreTable stores={stores} userId={userId} pagination={pagination} />;
};

export default StoreListWrapper;
