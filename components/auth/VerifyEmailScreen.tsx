'use client';

// React
import { useState, useEffect, useCallback } from 'react';

// Icons
import { PiArrowLeft, PiEnvelopeSimple, PiArrowCounterClockwise } from 'react-icons/pi';

// Shadcn
import { toast } from 'sonner';

// Actions
import { resendVerificationEmail } from '@/actions/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Seconds the resend button stays locked after each send. */
const RESEND_COOLDOWN_S = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyEmailScreenProps {
  /** Address the confirmation link was sent to — displayed and used for resend. */
  email: string;
  /** Called when the user clicks "Back to login". */
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-page card rendered after sign-up or when an unverified user attempts
 * to log in.
 *
 * Behaviour:
 *  - Countdown starts at `RESEND_COOLDOWN_S` immediately (an email was just
 *    sent by the parent action before this screen mounts).
 *  - "Resend" button is disabled until the countdown reaches 0.
 *  - Each successful resend resets the countdown to `RESEND_COOLDOWN_S`.
 *  - Supabase enforces its own platform-level rate limit as a secondary guard.
 */
export default function VerifyEmailScreen({ email, onBack }: VerifyEmailScreenProps) {
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
        {/* Back link */}
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

          {/* Spam hint */}
          <p className="mt-4 text-center text-xs text-slate-600">Can&apos;t find it? Check your spam or junk folder.</p>
        </div>
      </div>
    </div>
  );
}
