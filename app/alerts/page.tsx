export const dynamic = 'force-dynamic';

// Server Component

// API
import { getAlertsForUser } from '@/lib/alerts';
import { getCurrentUser } from '@/lib/users';

// Components
import AlertsPanel from '@/components/alerts/AlertsPanel';
import ErrorMessage from '@/components/shared/ErrorMessage';

const Page = async () => {
  const { success, user } = await getCurrentUser();

  if (!success || !user) {
    return <ErrorMessage message="You must be logged in to view alerts." />;
  }

  const alerts = await getAlertsForUser(user._id.toString());

  return (
    <div className="min-h-screen bg-slate-950 p-8 pt-26 font-sans text-slate-100">
      <div className="mx-auto max-w-400 space-y-8">
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
};

export default Page;
