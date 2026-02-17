import { ReactNode } from 'react';

interface DataTableProps {
  title: string;
  description: string;
  recordCount: number;
  headers: string[]; // e.g. ["Product", "Price", "Status"]
  headerBtn?: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean };
  children: ReactNode; // The <tbody> content (rows)
}

export const Table = ({ title, description, recordCount, headers, headerBtn, children }: DataTableProps) => {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/50 px-8 py-6 backdrop-blur-sm">
        {/* Title & Description */}
        <div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        {/* Tags & Button */}
        <div className="flex flex-row gap-4">
          <span className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-purple-300 shadow-lg">{recordCount} Records</span>

          {headerBtn && (
            <button onClick={headerBtn.onClick} disabled={headerBtn.disabled} className="flex items-center gap-2 rounded-md bg-linear-to-l from-pink-700 to-indigo-800 px-4 py-2 text-white hover:bg-linear-to-bl disabled:cursor-not-allowed disabled:opacity-50">
              {headerBtn.icon}
              {headerBtn.label}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5">
          <thead className="bg-slate-900/50">
            <tr>
              {headers.map((header, index) => (
                <th key={index} className={`px-8 py-4 text-xs font-bold tracking-widest text-slate-400 uppercase ${index === headers.length - 1 ? 'text-right' : 'text-left'}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5 bg-slate-900/30">{children}</tbody>
        </table>
      </div>
    </div>
  );
};
