// Server Actions
import { getStoresByUserIdAction } from '@/actions/stores';

// Components
import ErrorMessage from '../shared/ErrorMessage';
import StoreTable from './StoreTable';

// This component handles the actual "await"
const StoreListWrapper = async () => {
  const { stores = [], success, message } = await getStoresByUserIdAction();
  if (!success) return <ErrorMessage message={message} />;

  return <StoreTable stores={stores} />;
};

export default StoreListWrapper;
