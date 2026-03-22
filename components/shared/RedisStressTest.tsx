'use client';

import { useState } from 'react';
import { forceSyncAllProducts } from '@/actions/inventory';

// Types
type Result = {
  success: boolean;
  message: string;
};

export default function RedisStressTest() {
  const [results, setResults] = useState<Result[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const triggerRaceCondition = async () => {
    setIsTesting(true);
    setResults([]);
    console.log('🔥 Launching 5 concurrent sync requests...');

    // We do NOT await inside the map. We want all 5 to hit the server simultaneously.
    const promises = Array.from({ length: 5 }).map(() => forceSyncAllProducts());

    // Wait for all 5 parallel requests to finish
    const settled = await Promise.all(promises);

    setResults(settled);
    setIsTesting(false);
  };

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
      <h3 className="mb-2 text-sm font-bold text-red-400">Redis Lock Stress Test</h3>
      <button onClick={triggerRaceCondition} disabled={isTesting} className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50">
        {isTesting ? 'Attacking Server...' : '🔥 Fire 5 Concurrent Syncs'}
      </button>

      {/* Results Output */}
      {results.length > 0 && <pre className="mt-4 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-300">{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
