'use client';

// React
import { useState } from 'react';

// Next.js
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Icons
import { PiEye, PiEyeSlash } from 'react-icons/pi';

// Shadcn
import { toast } from 'sonner';

// Actions
import { sendPasswordResetOtp, verifyOtp, updatePassword } from '@/actions/auth';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** Inline field-level error message. */
const FieldError = ({ message }: { message?: string }) => (message ? <p className="mt-1.5 text-xs text-red-400">{message}</p> : null);

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const INPUT_BASE = 'w-full rounded-lg border bg-zinc-800 p-3 text-white placeholder-zinc-500 transition-all focus:outline-none focus:ring-2';
const inputCls = (hasError: boolean) => `${INPUT_BASE} ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-zinc-700 focus:ring-blue-500'}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Three-step forgot-password flow:
 *  1. Enter email → receive OTP
 *  2. Enter OTP   → verify identity
 *  3. Set new password
 *
 * Each step validates its own field(s) client-side before calling the server.
 * Server errors are mapped back to the relevant field via inline messages.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /** Clears a single field's error when the user starts editing. */
  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    const res = await sendPasswordResetOtp(email);
    setLoading(false);

    if (res.success) {
      toast.success('Code sent! Check your inbox.');
      setStep(2);
    } else {
      setErrors({ email: res.error || 'Failed to send code. Check the email address.' });
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!otp.trim()) errs.otp = 'Verification code is required.';
    else if (otp.trim().length < 6) errs.otp = 'Code must be at least 6 characters.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    const res = await verifyOtp(email, otp);
    setLoading(false);

    if (res.success) {
      toast.success('Code verified successfully');
      setStep(3);
    } else {
      setErrors({ otp: res.error || 'Invalid or expired code. Please try again.' });
    }
  };

  // ── Step 3: Update Password ──────────────────────────────────────────────

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!password) errs.password = 'Password is required.';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);

    if (res.success) {
      toast.success('Password updated! Redirecting…');
      router.push('/login');
    } else {
      setErrors({ password: res.error || 'Failed to update password. Please try again.' });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">Reset Password</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {step === 1 && 'Enter your email to receive a code.'}
            {step === 2 && 'Enter the code sent to your email.'}
            {step === 3 && 'Create a new strong password.'}
          </p>

          {/* Step progress dots */}
          <div className="mt-4 flex justify-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className={`h-1.5 w-8 rounded-full transition-colors duration-300 ${s <= step ? 'bg-blue-500' : 'bg-zinc-700'}`} />
            ))}
          </div>
        </div>

        {/* ── Step 1: Email ── */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-6" noValidate>
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-zinc-400 uppercase">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError('email');
                }}
                className={inputCls(!!errors.email)}
              />
              <FieldError message={errors.email} />
            </div>

            <button disabled={loading} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
              {loading ? 'Sending…' : 'Send Code'}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-zinc-400 transition-colors hover:text-white">
                ← Back to Login
              </Link>
            </div>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6" noValidate>
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-zinc-400 uppercase">Verification Code</label>
              <input
                type="text"
                placeholder="Enter the code from your email"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value);
                  clearError('otp');
                }}
                className={`${inputCls(!!errors.otp)} text-center text-2xl tracking-widest`}
                maxLength={8}
              />
              <FieldError message={errors.otp} />
            </div>

            <button disabled={loading} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrors({});
              }}
              className="w-full text-sm text-zinc-400 transition-colors hover:text-white">
              Wrong email? Go back
            </button>
          </form>
        )}

        {/* ── Step 3: New Password ── */}
        {step === 3 && (
          <form onSubmit={handleUpdatePassword} className="space-y-6" noValidate>
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-zinc-400 uppercase">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError('password');
                  }}
                  className={`${inputCls(!!errors.password)} pr-12`}
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword((p) => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 transition-colors hover:text-white">
                  {showPassword ? <PiEyeSlash size={18} /> : <PiEye size={18} />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            <button disabled={loading} className="w-full rounded-lg bg-green-600 p-3 font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
