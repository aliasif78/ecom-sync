import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
};

export const formatDate = (dateString: string): string => {
  if (!dateString || dateString === 'N/A') return 'N/A';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const isDuplicateError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) return true;
  return false;
};

export const getKeyPattern = (error: unknown) => {
  if (typeof error === 'object' && error && 'keyPattern' in error) return (error as { keyPattern: { config?: { storeUrl?: string }; name?: string } }).keyPattern;
  return null;
};

// Generic Response Type
type ActionResponse = { success: boolean; message: string; [key: string]: unknown };

interface RunActionOptions {
  action: () => Promise<ActionResponse>; // The server action to run
  validate?: () => boolean | string; // Optional: Return false or error string to block
  onSuccess?: (data?: ActionResponse) => void; // What to do after success (e.g. close modal)
  setIsLoading?: (loading: boolean) => void; // Your state setter
  successMessage?: string; // specific override (e.g. "Created!")
}

export const runServerAction = async ({ action, validate, onSuccess, setIsLoading, successMessage }: RunActionOptions) => {
  // 1. Validation Phase
  if (validate) {
    const result = validate();

    if (result === false) return toast.error('Please fill all required fields');
    if (typeof result === 'string') return toast.error(result);
  }

  // 2. Execution Phase
  setIsLoading?.(true);

  try {
    const res = await action();

    // Success
    if (res.success) {
      toast.success(successMessage || res.message);
      onSuccess?.(); // Pass full response in case you need data
    }

    // Error
    else {
      console.error(res.message);
      toast.error(res.message);
    }
  } catch (error) {
    console.error('CRITICAL_ACTION_ERROR:', error);
    toast.error('An unexpected system error occurred.');
  } finally {
    setIsLoading?.(false);
  }
};
