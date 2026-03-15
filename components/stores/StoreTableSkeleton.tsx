export const StoreTableSkeleton = () => {
  // We render 3 rows to fill the space visually
  const rows = Array.from({ length: 3 });

  return (
    <div className="w-full animate-pulse">
      {/* Table Shell Header Simulation */}
      <div className="mb-8 flex items-end justify-between px-4">
        <div>
          <div className="h-8 w-48 rounded-md bg-zinc-800" />
          <div className="mt-2 h-4 w-64 rounded-md bg-zinc-900" />
        </div>
        <div className="h-4 w-24 rounded-md bg-zinc-900" />
      </div>

      {/* Table Content */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950">
        <table className="w-full text-left">
          {/* Skeleton Headers */}
          <thead className="border-b border-white/5 bg-white/5">
            <tr>
              {['Store Identity', 'Platform', 'Connection', 'Sync Status', 'Last Activity', 'Actions'].map((h) => (
                <th key={h} className="px-8 py-4 text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {rows.map((_, i) => (
              <tr key={i} className="bg-zinc-950">
                {/* Col 1: Identity */}
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-zinc-800" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-zinc-800" />
                      <div className="h-3 w-20 rounded bg-zinc-900" />
                    </div>
                  </div>
                </td>

                {/* Col 2: Platform */}
                <td className="px-8 py-5">
                  <div className="h-6 w-20 rounded-lg bg-zinc-800" />
                </td>

                {/* Col 3: Connection */}
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
                    <div className="h-4 w-12 rounded bg-zinc-900" />
                  </div>
                </td>

                {/* Col 4: Sync Status */}
                <td className="px-8 py-5">
                  <div className="h-7 w-28 rounded-full bg-zinc-800/50" />
                </td>

                {/* Col 5: Last Activity */}
                <td className="px-8 py-5">
                  <div className="h-4 w-24 rounded bg-zinc-900" />
                </td>

                {/* Col 6: Actions */}
                <td className="px-8 py-5">
                  <div className="flex justify-end gap-3">
                    <div className="h-8 w-8 rounded-md bg-zinc-800" />
                    <div className="h-8 w-8 rounded-md bg-zinc-800" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
