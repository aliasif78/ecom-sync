'use client';

// React
import { useState } from 'react';

// Next Js
import Link from 'next/link';

// Shadcn
import { toast } from 'sonner';

// Icons
import { PiArrowLeft } from 'react-icons/pi';

export default function LoginPage() {
  // =========
  // States
  // =========

  // General
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Core Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup Only State
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Store Info State
  const [shopifyStore, setShopifyStore] = useState('');
  const [amazonStore, setAmazonStore] = useState('');
  const [wooStore, setWooStore] = useState('');

  // =========
  // Functions
  // =========
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // LOGIN LOGIC
      if (isLogin) {
        console.log('Logging in:', email);
        // await login(email, password);
        toast.info('Login logic coming soon...');
      }

      // SIGNUP LOGIC
      else {
        // 1. Validation
        if (password !== confirmPassword) {
          toast.error("Passwords don't match");
          setIsLoading(false);
          return;
        }

        // 2. Prepare Data
        const userData = { email, password, fullName, stores: { shopify: shopifyStore, amazon: amazonStore, woocommerce: wooStore } };
        console.log('Signing up with:', userData);
        toast.info('Signup logic coming soon...');
      }
    } catch (error) {
      toast.error('Authentication failed');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Form */}
      <div className="relative w-full max-w-md space-y-8">
        {/* Back Arrow */}
        <Link href="/" className="absolute top-2 left-0 text-white transition-colors hover:text-indigo-500">
          <PiArrowLeft size={24} />
        </Link>

        {/* Brand Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Ecomm<span className="text-indigo-500">Sync</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">{isLogin ? 'Welcome back, Captain.' : 'Initialize your command center.'}</p>
        </div>

        {/* The Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-xl transition-all duration-300">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* --- SIGNUP ONLY FIELDS --- */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-4 space-y-5 duration-300">
                {/* Full Name */}
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Full Name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="John Doe" />
                </div>

                {/* Store Info Section */}
                <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">Store Connections (Optional)</p>

                  <input type="text" value={shopifyStore} onChange={(e) => setShopifyStore(e.target.value)} className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="Shopify Store URL (myshop.shopify.com)" />
                  <input type="text" value={amazonStore} onChange={(e) => setAmazonStore(e.target.value)} className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="Amazon Seller ID" />
                  <input type="text" value={wooStore} onChange={(e) => setWooStore(e.target.value)} className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" placeholder="WooCommerce Store URL" />
                </div>
              </div>
            )}

            {/* --- COMMON FIELDS --- */}

            {/* Email */}
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="admin@ecommsync.com" />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" placeholder="••••••••" />
            </div>

            {/* Confirm Password (Signup Only) */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">Confirm Password</label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`block w-full rounded-lg border bg-slate-950 px-4 py-3 text-white transition-all focus:outline-none ${confirmPassword && confirmPassword !== password ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'}`} placeholder="••••••••" />
                {confirmPassword && confirmPassword !== password && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button type="submit" disabled={isLoading} className="group relative flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-indigo-500/30 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>

          {/* Toggle Link */}
          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <p className="text-sm text-slate-400">
              {isLogin ? 'New to EcommSync? ' : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  // Clear sensitivity fields on toggle
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="font-medium text-indigo-400 transition-colors hover:text-indigo-300 hover:underline focus:outline-none">
                {isLogin ? 'Sign up now' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
