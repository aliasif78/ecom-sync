'use client';

// React
import { useState } from 'react';

// Next Js
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Shadcn
import { toast } from 'sonner';

// Actions
import { sendPasswordResetOtp, verifyOtp, updatePassword } from '@/actions/auth';

export default function ForgotPasswordPage() {
  // States
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');

  // Hooks
  const router = useRouter();

  // Functions
  // Generic Helper for all 3 steps
  const handleSubmit = async (e: React.FormEvent, action: () => Promise<{ success: boolean; error?: string }>, successMessage: string, onSuccess: () => void) => {
    e.preventDefault();
    setLoading(true);

    // Call the action
    const res = await action();
    setLoading(false);

    // Success
    if (res.success) {
      toast.success(successMessage);
      onSuccess();
    }

    // Error
    else toast.error(res.error || 'An error occurred');
  };

  // Step 1: Send Code
  const handleSendOtp = async (e: React.FormEvent) => {
    handleSubmit(
      e,
      () => sendPasswordResetOtp(email),
      'Code sent! Check your inbox.',
      () => setStep(2)
    );
  };

  // Step 2: Verify Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    handleSubmit(
      e,
      () => verifyOtp(email, otp),
      'Code verified successfully',
      () => setStep(3)
    );
  };

  // Step 3: Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    handleSubmit(
      e,
      () => updatePassword(password),
      'Password updated! Redirecting...',
      () => router.push('/login')
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">Reset Password</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {step === 1 && 'Enter your email to receive a code.'}
            {step === 2 && 'Enter the 8-digit code sent to your email.'}
            {step === 3 && 'Create a new strong password.'}
          </p>
        </div>

        {/* Form 1: Email Input */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
            <button disabled={loading} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Code'}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-zinc-400 hover:text-white">
                Back to Login
              </Link>
            </div>
          </form>
        )}

        {/* Form 2: OTP Input */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <input type="text" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-center text-2xl tracking-widest text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none" required maxLength={8} />
            <button disabled={loading} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-zinc-400 hover:text-white">
              Wrong email? Go back
            </button>
          </form>
        )}

        {/* Form 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none" required minLength={6} />
            <button disabled={loading} className="w-full rounded-lg bg-green-600 p-3 font-semibold text-white hover:bg-green-500 disabled:opacity-50">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
