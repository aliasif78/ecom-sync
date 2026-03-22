import { useState } from 'react';
import { toast } from 'sonner';

const ChaosModeBtn = ({ initialChaos }: { initialChaos: boolean }) => {
  const [chaosMode, setChaosMode] = useState(initialChaos);

  // 🐒 The Trigger Logic
  const toggleChaos = () => {
    const newState = !chaosMode;
    setChaosMode(newState);

    if (newState) {
      // Set cookie for 1 day - Server Actions will look for this
      document.cookie = 'chaos_mode=true; path=/; max-age=86400';
      toast.error('🐒 Chaos Mode Activated! APIs will now randomly fail.');
    } else {
      // Delete cookie
      document.cookie = 'chaos_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      toast.success('🛡️ Chaos Mode Deactivated. Systems normal.');
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
      <span className="text-xs font-semibold text-zinc-400">CHAOS</span>

      <button onClick={toggleChaos} title="Toggle Chaos Mode (Simulate 500 Errors)" className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${chaosMode ? 'bg-red-500' : 'bg-zinc-700'}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${chaosMode ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  );
};

export default ChaosModeBtn;
