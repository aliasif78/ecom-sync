import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
