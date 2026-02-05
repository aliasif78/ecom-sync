import React, { ReactNode } from 'react';

// --- 1. The Shell (Backdrop + Container) ---
export const ModalShell = ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) => {
  if (!isOpen) return null;
  return (
    <div className="animate-in fade-in zoom-in-95 fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl transition-all duration-300">{children}</div>
    </div>
  );
};

// --- 2. The Header ---
export const ModalHeader = ({ title, description, onClose }: { title: string; description?: ReactNode; onClose: () => void }) => (
  <div className="mb-6 flex items-start justify-between">
    <div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {description && <div className="mt-1 text-sm text-slate-400">{description}</div>}
    </div>

    <button onClick={onClose} className="text-slate-500 transition-colors hover:text-white">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

// --- 3. The Input Field ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  suffix?: string;
}

export const ModalInput = ({ label, suffix, className, ...props }: InputProps) => (
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</label>

    <div className="relative">
      <input {...props} className={`block w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-4 text-white placeholder-slate-600 transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${suffix ? 'pr-12' : 'pr-4'} ${className}`} />

      {suffix && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-sm text-slate-500">{suffix}</span>
        </div>
      )}
    </div>
  </div>
);

// --- 4. The Select Field ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export const ModalSelect = ({ label, options, ...props }: SelectProps) => (
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</label>

    <select {...props} className="block w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none">
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

// --- 5. The Footer (Actions) ---
export const ModalFooter = ({ onCancel, onConfirm, isLoading, confirmText = 'Confirm' }: { onCancel: () => void; onConfirm: () => void; isLoading: boolean; confirmText?: string }) => (
  <div className="mt-8 flex gap-3">
    <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700">
      Cancel
    </button>

    <button onClick={onConfirm} disabled={isLoading} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </span>
      ) : (
        confirmText
      )}
    </button>
  </div>
);
