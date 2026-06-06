'use client';

// React
import { useState, useEffect, useCallback } from 'react';

// Next.js
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Icons
import { PiArrowLeft, PiEye, PiEyeSlash, PiEnvelopeSimple, PiArrowCounterClockwise } from 'react-icons/pi';

// Shadcn
import { toast } from 'sonner';

// Actions
import { login, signUp, resendVerificationEmail } from '@/actions/auth';

// Utils
import { getErrorMessage } from '@/lib/utils';

// Components
import GoogleButton from '@/components/auth/GoogleButton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthErrors = Partial<Record<'email' | 'password' | 'fullName' | 'confirmPassword' | 'general', string>>;

/** Top-level view state for the login page. */
type View = 'auth' | 'verify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cooldown duration in seconds between resend attempts. */
const RESEND_COOLDOWN_S = 60;

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** Inline field-level error message. Renders nothing when message is falsy. */
const FieldError = ({ message }: { message?: string }) => (message ? <p className="mt-1.5 text-xs text-red-400">{message}</p> : null);

// ---------------------------------------------------------------------------
// VerifyEmailScreen
// ---------------------------------------------------------------------------

interface VerifyEmailScreenProps {
  /** The email address to display and to which we resend the link. */
  email: string;
  /** Called when the user clicks "Back to login". */
  onBack: () => void;
}

/**
 * Full-page card shown after a successful sign-up (or login attempt on an
 * unverified account).  Features:
 *  - Clear copy explaining what the user should do next.
 *  - "Resend" button that fires `resendVerificationEmail` and then locks
 *    itself for `RESEND_COOLDOWN_S` seconds to prevent spam.
 *  - Countdown timer that ticks down in real-time.
 */
function VerifyEmailScreen({ email, onBack }: VerifyEmailScreenProps) {
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_S);
  const [isResending, setIsResending] = useState(false);

  const canResend = countdown === 0 && !isResending;

  // Tick the countdown down every second until it reaches 0.
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1_000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    setIsResending(true);
    try {
      const res = await resendVerificationEmail(email);
      if (res.success) {
        toast.success('Verification email resent — check your inbox.');
        setCountdown(RESEND_COOLDOWN_S);
      } else {
        toast.error(res.error || 'Failed to resend. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  }, [canResend, email]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Back arrow */}
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
          <PiArrowLeft size={18} />
          Back to login
        </button>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-xl">
          {/* Icon + heading */}
          <div className="mb-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10">
              <PiEnvelopeSimple size={32} className="text-indigo-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">Check your inbox</h2>
              <p className="mt-2 text-sm text-slate-400">We sent a verification link to</p>
              <p className="mt-1 font-mono text-sm font-semibold break-all text-indigo-400">{email}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-400">Click the link in the email to verify your account. Once verified, you can sign in. The link expires after 24 hours.</div>

          {/* Resend button */}
          <button onClick={handleResend} disabled={!canResend} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-300 transition-all hover:enabled:bg-slate-700 hover:enabled:text-white disabled:cursor-not-allowed disabled:opacity-50">
            <PiArrowCounterClockwise size={16} className={isResending ? 'animate-spin' : ''} />
            {isResending ? 'Resending…' : canResend ? 'Resend verification email' : `Resend in ${countdown}s`}
          </button>

          {/* Hint */}
          <p className="mt-4 text-center text-xs text-slate-600">Can&apos;t find the email? Check your spam or junk folder.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the login or sign-up form client-side.
 * Returns a field → error map, or null when everything is valid.
 */
function validate(isLogin: boolean, fields: { email: string; password: string; fullName: string; confirmPassword: string }): AuthErrors | null {
  const errs: AuthErrors = {};

  if (!fields.email.trim()) errs.email = 'Email is required.';
  else if (!EMAIL_RE.test(fields.email)) errs.email = 'Enter a valid email address.';

  if (!fields.password) errs.password = 'Password is required.';
  else if (fields.password.length < 6) errs.password = 'Password must be at least 6 characters.';

  if (!isLogin) {
    if (!fields.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!fields.confirmPassword) errs.confirmPassword = 'Please confirm your password.';
    else if (fields.confirmPassword !== fields.password) errs.confirmPassword = 'Passwords do not match.';
  }

  return Object.keys(errs).length ? errs : null;
}

/**
 * Maps a server error string to the most relevant form field.
 * Falls back to the 'general' key for the banner above the form.
 */
function mapServerError(msg: string): AuthErrors {
  const lower = msg.toLowerCase();
  if (lower.includes('password')) return { password: msg };
  if (lower.includes('email') || lower.includes('user') || lower.includes('exist')) return { email: msg };
  return { general: msg };
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();

  // ── View ──
  const [view, setView] = useState<View>('auth');
  const [pendingEmail, setPendingEmail] = useState('');

  // ── Mode ──
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});

  // ── Shared fields ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Sign-up only fields ──
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Optional store connection fields ──
  const [shopifyStore, setShopifyStore] = useState('');
  const [amazonStore, setAmazonStore] = useState('');
  const [wooStore, setWooStore] = useState('');

  /** Clears a single field's error as soon as the user starts typing. */
  const clearError = (field: keyof AuthErrors) => setErrors((prev) => ({ ...prev, [field]: undefined }));

  /**
   * Switches to the email verification screen.
   * Stores the email so the resend button knows where to send.
   */
  const enterVerifyView = (emailAddress: string) => {
    setPendingEmail(emailAddress);
    setView('verify');
  };

  /** Resets back to the auth card in login mode. */
  const exitVerifyView = () => {
    setView('auth');
    setIsLogin(true);
    setErrors({});
  };

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Client-side validation
    const fieldErrors = validate(isLogin, { email, password, fullName, confirmPassword });
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        const res = await login({ email, password });

        // Unverified account — redirect to the verification screen.
        if ('requiresEmailVerification' in res && res.requiresEmailVerification) {
          enterVerifyView(res.email ?? email);
          return;
        }

        if (!res.success) {
          setErrors(mapServerError(getErrorMessage(res.error as string)));
          return;
        }

        toast.success('Login successful');
        router.push('/products');
      } else {
        const res = await signUp({
          email,
          password,
          confirmPassword,
          name: fullName,
          stores: { shopify: shopifyStore, amazon: amazonStore, woocommerce: wooStore },
        });

        if (!res.success) {
          setErrors(mapServerError(getErrorMessage(res.error as string)));
          return;
        }

        // Email confirmation required — show the verify screen instead of
        // redirecting to /products (which would fail — user isn't logged in).
        if ('requiresEmailVerification' in res && res.requiresEmailVerification) {
          enterVerifyView(res.email ?? email);
          return;
        }

        // Supabase email confirmation disabled edge-case — proceed normally.
        toast.success('Account created successfully');
        router.push('/products');
      }
    } catch (error) {
      toast.error('Authentication failed');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Verify view
  // ---------------------------------------------------------------------------

  if (view === 'verify') {
    return <VerifyEmailScreen email={pendingEmail} onBack={exitVerifyView} />;
  }

  // ---------------------------------------------------------------------------
  // Render: Auth view
  // ---------------------------------------------------------------------------

  /** Reusable base classes for every text input on this page. */
  const inputCls = (hasError: boolean) => ['block w-full rounded-lg border bg-slate-950 px-4 py-3 text-white transition-all focus:outline-none focus:ring-1', hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'].join(' ');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-md space-y-8">
        {/* Back arrow */}
        <Link href="/" className="absolute top-2 left-0 text-white transition-colors hover:text-indigo-500">
          <PiArrowLeft size={24} />
        </Link>

        {/* Brand header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Ecomm<span className="text-indigo-500">Sync</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">{isLogin ? 'Welcome back, Captain.' : 'Initialize your command center.'}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-xl transition-all duration-300">
          {/* General / non-field server error banner */}
          {errors.general && <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{errors.general}</div>}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* ── SIGN-UP ONLY FIELDS ── */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-4 space-y-5 duration-300">
                {/* Full Name */}
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearError('fullName');
                    }}
                    className={inputCls(!!errors.fullName)}
                    placeholder="John Doe"
                  />
                  <FieldError message={errors.fullName} />
                </div>

                {/* Optional store connections */}
                <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">Store Connections (Optional)</p>
                  <input type="text" value={shopifyStore} onChange={(e) => setShopifyStore(e.target.value)} className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="Shopify Store URL (myshop.shopify.com)" />
                  <input type="text" value={amazonStore} onChange={(e) => setAmazonStore(e.target.value)} className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="Amazon Seller ID" />
                  <input type="text" value={wooStore} onChange={(e) => setWooStore(e.target.value)} className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="WooCommerce Store URL" />
                </div>
              </div>
            )}

            {/* ── COMMON FIELDS ── */}

            {/* Email */}
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError('email');
                }}
                className={inputCls(!!errors.email)}
                placeholder="admin@ecommsync.com"
              />
              <FieldError message={errors.email} />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError('password');
                  }}
                  className={`${inputCls(!!errors.password)} pr-12`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword((p) => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-white">
                  {showPassword ? <PiEyeSlash size={18} /> : <PiEye size={18} />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            {/* Forgot password link (login mode only) */}
            {isLogin && (
              <div className="-mt-2 text-right">
                <Link href="/login/forgot-password" className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300 hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Confirm Password (sign-up only) */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearError('confirmPassword');
                    }}
                    className={`${inputCls(!!errors.confirmPassword)} pr-12`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirm((p) => !p)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-white">
                    {showConfirm ? <PiEyeSlash size={18} /> : <PiEye size={18} />}
                  </button>
                </div>
                <FieldError message={errors.confirmPassword} />
              </div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button type="submit" disabled={isLoading} className="group relative flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-indigo-500/30 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing…
                  </span>
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>

          {/* Toggle between login / sign-up */}
          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <p className="text-sm text-slate-400">
              {isLogin ? 'New to EcommSync? ' : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin((prev) => !prev);
                  setPassword('');
                  setConfirmPassword('');
                  setErrors({});
                }}
                className="font-medium text-indigo-400 transition-colors hover:text-indigo-300 hover:underline focus:outline-none">
                {isLogin ? 'Sign up now' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Google OAuth */}
          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <GoogleButton />
          </div>
        </div>
      </div>
    </div>
  );
}
