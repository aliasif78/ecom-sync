import React, { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared inline field-error message atom.
// Renders nothing when `message` is falsy — safe to always mount.
// ---------------------------------------------------------------------------

/**
 * Renders a red error message below a form field.
 * @param message - The error string to display. Renders nothing if falsy.
 */
export const FieldError = ({ message }: { message?: string }) => (message ? <p className="mt-1.5 text-xs text-red-400">{message}</p> : null);

// ---------------------------------------------------------------------------
// 1. ModalShell — backdrop + centered container
// ---------------------------------------------------------------------------

export const ModalShell = ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) => {
  if (!isOpen) return null;
  return (
    <div className="animate-in fade-in zoom-in-95 fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs transition-all duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl transition-all duration-300">{children}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. ModalHeader — title + optional description + close button
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 3. ModalInput — labelled text/number input with optional suffix + error
// ---------------------------------------------------------------------------

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Unit label shown inside the right edge of the input (e.g. "USD", "units"). */
  suffix?: string;
  /**
   * Inline validation error. When present the border turns red and the
   * message appears below the input.
   */
  error?: string;
}

export const ModalInput = ({ label, suffix, className, error, ...props }: InputProps) => (
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</label>

    <div className="relative">
      <input
        {...props}
        className={[
          'block w-full rounded-lg border bg-slate-950 py-3 pl-4 text-white placeholder-slate-600 transition-all focus:ring-1 focus:outline-none',
          // Error state → red border; default → slate with indigo focus
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500',
          suffix ? 'pr-12' : 'pr-4',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      />

      {suffix && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-sm text-slate-500">{suffix}</span>
        </div>
      )}
    </div>

    {/* Inline error message */}
    <FieldError message={error} />
  </div>
);

// ---------------------------------------------------------------------------
// 4. ModalSelect — labelled <select> with optional error
// ---------------------------------------------------------------------------

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  /**
   * Inline validation error. When present the border turns red and the
   * message appears below the select.
   */
  error?: string;
}

export const ModalSelect = ({ label, options, error, ...props }: SelectProps) => (
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</label>

    <select {...props} className={['block w-full appearance-none rounded-lg border bg-slate-950 px-4 py-3 text-white transition-all focus:ring-1 focus:outline-none', error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'].join(' ')}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>

    <FieldError message={error} />
  </div>
);

// ---------------------------------------------------------------------------
// 5. ModalFooter — cancel + confirm action row
// ---------------------------------------------------------------------------

export const ModalFooter = ({ onCancel, onConfirm, isLoading, confirmText = 'Confirm' }: { onCancel: () => void; onConfirm: () => void; isLoading: boolean; confirmText?: string }) => (
  <div className="mt-8 flex gap-3">
    <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700">
      Cancel
    </button>

    <button onClick={onConfirm} disabled={isLoading} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      ) : (
        confirmText
      )}
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// 6. ModalToggle — labelled boolean toggle switch
// ---------------------------------------------------------------------------

export const ModalToggle = ({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (checked: boolean) => void; description?: string }) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-4">
    <div>
      <span className="block text-sm font-semibold text-white">{label}</span>
      {description && <span className="mt-1 block text-xs text-slate-400">{description}</span>}
    </div>

    <button onClick={() => onChange(!checked)} type="button" className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}>
      <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);
