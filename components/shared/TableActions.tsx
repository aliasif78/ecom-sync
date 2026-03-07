import React from 'react';

// --- Ghost Button (History, Edit, Delete) ---
interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger';
  icon?: React.ReactNode;
}

export const ActionButton = ({ variant = 'default', className, icon, ...props }: ActionButtonProps) => {
  const baseStyles = 'relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-all';

  const variants = {
    default: 'text-slate-400 hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-400',
    danger: 'text-slate-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400',
  };

  return (
    <button type="button" className={`${baseStyles} ${variants[variant]} ${className} disabled:cursor-not-allowed disabled:opacity-50`} {...props}>
      {icon}
    </button>
  );
};

// --- Icons (SVG Wrappers) ---
export const Icons = {
  History: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Edit: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Delete: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Sync: () => (
    <svg className="animate-spin-slow h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
};
