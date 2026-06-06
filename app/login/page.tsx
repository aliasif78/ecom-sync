'use client';

// React
import { useState } from 'react';

// Next.js
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Icons
import { PiArrowLeft, PiEye, PiEyeSlash } from 'react-icons/pi';

// Shadcn
import { toast } from 'sonner';

// Actions
import { login, signUp } from '@/actions/auth';

// Utils
import { getErrorMessage } from '@/lib/utils';

// Components
import GoogleButton from '@/components/auth/GoogleButton';
import VerifyEmailScreen from '@/components/auth/VerifyEmailScreen';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthErrors = Partial<Record<'email' | 'password' | 'fullName' | 'confirmPassword' | 'general', string>>;

/** Controls which top-level screen is visible. */
type View = 'auth' | 'verify';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline field-level error. Renders nothing when message is falsy. */
const FieldError = ({ message }: { message?: string }) => (message ? <p className="mt-1.5 text-xs text-red-400">{message}</p> : null);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Falls back to 'general' so it appears in the banner above the form.
 */
function mapServerError(msg: string): AuthErrors {
  const lower = msg.toLowerCase();
  if (lower.includes('password')) return { password: msg };
  if (lower.includes('email') || lower.includes('user') || lower.includes('exist')) return { email: msg };
  return { general: msg };
}

// ---------------------------------------------------------------------------
// Page
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

  const clearError = (field: keyof AuthErrors) => setErrors((prev) => ({ ...prev, [field]: undefined }));

  /** Switches to the email-verification screen, storing the target address. */
  const enterVerifyView = (addr: string) => {
    setPendingEmail(addr);
    setView('verify');
  };

  /** Returns to the auth card in login mode, clearing all error state. */
  const exitVerifyView = () => {
    setView('auth');
    setIsLogin(true);
    setErrors({});
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        // Supabase email confirmation enabled — show verify screen.
        if ('requiresEmailVerification' in res && res.requiresEmailVerification) {
          enterVerifyView(res.email ?? email);
          return;
        }

        // Edge-case: email confirmation disabled on Supabase project.
        toast.success('Account created successfully');
        router.push('/products');
      }
    } catch (err) {
      toast.error('Authentication failed');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: verify screen (completely replaces the auth card)
  // ---------------------------------------------------------------------------

  if (view === 'verify') {
    return <VerifyEmailScreen email={pendingEmail} onBack={exitVerifyView} />;
  }

  // ---------------------------------------------------------------------------
  // Render: auth card
  // ---------------------------------------------------------------------------

  const inputCls = (hasError: boolean) => ['block w-full rounded-lg border bg-slate-950 px-4 py-3 text-white transition-all focus:outline-none focus:ring-1', hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'].join(' ');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-md space-y-8">
        {/* Back arrow */}
        <Link href="/" className="absolute top-2 left-0 text-white transition-colors hover:text-indigo-500">
          <PiArrowLeft size={24} />
        </Link>

        {/* Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Ecomm<span className="text-indigo-500">Sync</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">{isLogin ? 'Welcome back, Captain.' : 'Initialize your command center.'}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-xl transition-all duration-300">
          {/* General error banner */}
          {errors.general && <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{errors.general}</div>}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* ── Sign-up only ── */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-4 space-y-5 duration-300">
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

            {/* ── Email ── */}
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
                placeholder="admin@ecomsync.com"
              />
              <FieldError message={errors.email} />
            </div>

            {/* ── Password ── */}
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

            {/* Forgot password (login only) */}
            {isLogin && (
              <div className="-mt-2 text-right">
                <Link href="/login/forgot-password" className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300 hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            {/* ── Confirm password (sign-up only) ── */}
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

            {/* ── Submit ── */}
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

          {/* Toggle login / sign-up */}
          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <p className="text-sm text-slate-400">
              {isLogin ? 'New to EcomSync? ' : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin((p) => !p);
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
