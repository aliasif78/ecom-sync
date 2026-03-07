'use client';

// Interfaces
interface StatItem {
  label: string;
  value: string | number;
  colorClass?: string; // e.g. "text-indigo-400"
}

interface PageHeaderProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  stats?: StatItem[];
}

const PageHeader = ({ title, description, actionLabel, onAction, stats = [] }: PageHeaderProps) => {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end">
      {/* Left: Title & Description */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-slate-400">{description}</p>
      </div>

      {/* Right: Stats & Action */}
      <div className="flex items-center gap-4">
        {/* Dynamic Stats Rendering */}
        {stats.map((stat, index) => (
          <div key={index} className="hidden rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 sm:block">
            <span className="block text-xs font-bold tracking-wider text-slate-500 uppercase">{stat.label}</span>
            <span className={`font-mono text-xl font-bold ${stat.colorClass || 'text-white'}`}>{stat.value}</span>
          </div>
        ))}

        {/* Primary Action Button */}
        <button onClick={onAction} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default PageHeader;
