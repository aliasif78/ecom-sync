// Server Actions
import { getStoresByUserIdAction } from '@/actions/stores';

// Components
import ErrorMessage from '../shared/ErrorMessage';
import StoreTable from './StoreTable';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Server component wrapper responsible for fetching stores and passing them
 * to the `StoreTable` client component.
 *
 * Also surfaces `userId` from the action response so `StoreTable` can
 * subscribe to the correct Pusher channel for real-time `store-verified`
 * events — without requiring a separate round-trip to resolve the session user.
 */
const StoreListWrapper = async () => {
  const { stores = [], userId = '', success, message } = await getStoresByUserIdAction();

  if (!success) return <ErrorMessage message={message} />;

  return <StoreTable stores={stores} userId={userId} />;
};

export default StoreListWrapper;
