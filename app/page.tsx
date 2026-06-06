/**
 * @fileoverview EcomSync Landing Page
 *
 * Sections and their animation personalities:
 *  - Hero          → immediate CSS fade-up cascade (no IO needed)
 *  - Problem       → cards sweep in from the LEFT  (fade-left)
 *  - Solution      → left/right convergence + hub scale-in
 *  - How It Works  → 3-D flip-up per step card (flip-up)
 *  - Features      → overshoot pop-in per card   (pop-in)
 *  - CTA           → brightness-bloom glow-rise   (glow-rise)
 *
 * Scroll behaviour: "See How It Works" uses SmoothScrollButton which calls
 * scrollIntoView() — no URL hash, no browser history entry.
 */

import LightPillar from '@/components/ui/LightPillar';
import Link from 'next/link';
import AnimateOnScroll from '@/components/home/AnimateOnScroll';
import SmoothScrollButton from '@/components/home/SmoothScrollButton';

// ---------------------------------------------------------------------------
// Purely visual sub-components (server-safe, zero state)
// ---------------------------------------------------------------------------

/** Animated status badge in the hero. */
function StatusBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-widest text-slate-400 uppercase backdrop-blur-sm">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Real-time Sync Engine — Active
    </div>
  );
}

/** Coloured platform pill shown in the hero. */
function PlatformPill({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-sm" style={{ borderColor: `${color}40`, backgroundColor: `${color}12`, color }}>
      <span className="text-base">{icon}</span>
      {label}
    </div>
  );
}

/** Feature card for the six-column features grid. */
function FeatureCard({ icon, title, description, accent }: { icon: string; title: string; description: string; accent: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.06]">
      {/* Accent glow on hover */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: accent }} />
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${accent}18`, border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

/** Red pain-point card for the problem section. */
function PainCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
      <span className="mt-0.5 text-red-400">✗</span>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

/** Indigo solution card for the solution section. */
function SolutionCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
      <span className="mt-0.5 text-indigo-400">✓</span>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

/** Numbered step card for the how-it-works section. */
function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
      <span className="font-mono text-xs font-bold tracking-widest text-indigo-500 uppercase">{step}</span>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PAIN_POINTS = ['Change a price on Shopify? Now manually update Amazon and WooCommerce too.', 'Stock runs out on one platform — the other two keep selling, causing oversells.', 'A product description update across 3 platforms takes 30 minutes every time.', 'API failures go unnoticed — your stores silently drift out of sync.', 'No single view of your total inventory across all channels.', 'Race conditions corrupt stock counts when two orders hit simultaneously.'];

const SOLUTION_POINTS = ['Update once — EcomSync propagates to all platforms automatically.', 'Distributed locking ensures no two jobs corrupt the same SKU simultaneously.', 'Automatic retries on API failures mean no silent de-syncs.', 'Full immutable event ledger — every stock change is auditable.', 'Real-time dashboard view of all your inventory across every channel.', 'AI-powered stockout predictions before you run out.'];

const FEATURES = [
  {
    icon: '🔄',
    title: 'Real-time Multi-platform Sync',
    description: 'Propagate inventory changes to Shopify, Amazon, and WooCommerce the moment they happen — with live progress updates in your dashboard.',
    accent: '#6366f1',
  },
  {
    icon: '🔒',
    title: 'Distributed Locking (Redis)',
    description: 'Redis-backed locks ensure no two sync workers ever write to the same SKU simultaneously, eliminating race condition data corruption.',
    accent: '#8b5cf6',
  },
  {
    icon: '🔁',
    title: 'Automatic Retry Workflows',
    description: 'Inngest workflows automatically retry failed platform API calls with exponential backoff — your updates always eventually land.',
    accent: '#3b82f6',
  },
  {
    icon: '📋',
    title: 'Immutable Inventory Ledger',
    description: 'Every stock movement is recorded as an immutable event (INVENTORY_ADJUSTED, ORDER_CREATED) in MongoDB. Full audit trail, always.',
    accent: '#06b6d4',
  },
  {
    icon: '🤖',
    title: 'AI Stockout Predictions',
    description: 'Gemini Flash analyses your sales velocity and flags products that are selling too fast before they run out — so you can restock proactively.',
    accent: '#10b981',
  },
  {
    icon: '💬',
    title: 'Natural Language Copilot',
    description: 'Ask the built-in AI copilot anything: "How many units of SKU-42 are left across all stores?" or "Trigger a manual sync for all Shopify products."',
    accent: '#f59e0b',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white selection:bg-indigo-500/30">
      {/* ------------------------------------------------------------------ */}
      {/* GLOBAL DECORATIVE LAYER                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-700/10 blur-[120px]" />
        <div className="absolute top-40 left-[-10%] h-[400px] w-[500px] rounded-full bg-violet-900/15 blur-[100px]" />
        <div className="absolute top-60 right-[-10%] h-[350px] w-[450px] rounded-full bg-blue-900/15 blur-[100px]" />
        {/* Subtle dot-grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ================================================================== */}
      {/* SECTION 1 — HERO                                                    */}
      {/* Animations: immediate fade-up cascade, no IntersectionObserver.    */}
      {/* Each element has an increasing animationDelay for a stagger effect. */}
      {/* ================================================================== */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        {/* WebGL pillar background */}
        <div className="absolute inset-0 z-0 opacity-60">
          <LightPillar topColor="#6366f1" bottomColor="#020617" intensity={0.8} rotationSpeed={0.2} glowAmount={0.0015} pillarWidth={2.5} pillarHeight={0.35} noiseIntensity={0.4} pillarRotation={20} interactive={false} mixBlendMode="screen" quality="medium" />
        </div>

        <div className="relative z-10 flex max-w-4xl flex-col items-center gap-6">
          {/* Status badge — delay 0ms */}
          <div className="animate-es-fade-up" style={{ animationDelay: '0ms' }}>
            <StatusBadge />
          </div>

          {/* Headline — each line staggered 120ms apart */}
          <h1 className="text-5xl leading-[1.1] font-bold tracking-tight text-balance drop-shadow-2xl md:text-7xl">
            <span className="animate-es-fade-up block text-white" style={{ animationDelay: '120ms' }}>
              One Update.
            </span>
            <span className="animate-es-fade-up block bg-linear-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent" style={{ animationDelay: '240ms' }}>
              Every Platform.
            </span>
            <span className="animate-es-fade-up block text-white" style={{ animationDelay: '360ms' }}>
              Instantly.
            </span>
          </h1>

          {/* Sub-headline — delay 480ms */}
          <p className="animate-es-fade-up max-w-2xl text-lg text-balance text-slate-400 md:text-xl" style={{ animationDelay: '480ms' }}>
            EcomSync is the distributed inventory command center that keeps your products perfectly in sync across <span className="font-medium text-slate-300">Shopify</span>, <span className="font-medium text-slate-300">Amazon</span>, and <span className="font-medium text-slate-300">WooCommerce</span> — from a single dashboard, in real-time.
          </p>

          {/* Platform pills — delay 600ms */}
          <div className="animate-es-fade-up mt-2 flex flex-wrap justify-center gap-3" style={{ animationDelay: '600ms' }}>
            <PlatformPill label="Shopify" color="#96BF48" icon="🛍" />
            <PlatformPill label="Amazon" color="#FF9900" icon="📦" />
            <PlatformPill label="WooCommerce" color="#7F54B3" icon="🛒" />
          </div>

          {/* CTAs — delay 720ms */}
          <div className="animate-es-fade-up mt-6 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '720ms' }}>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-600 px-8 text-sm font-semibold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 focus-visible:outline-2 focus-visible:outline-indigo-400">
              Open Dashboard →
            </Link>
            {/*
              SmoothScrollButton: scrolls to #how-it-works via JS scrollIntoView()
              so no hash is ever appended to the URL.
            */}
            <SmoothScrollButton targetId="how-it-works" className="inline-flex h-12 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 px-8 text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10">
              See How It Works
            </SmoothScrollButton>
          </div>

          {/* Tech strip — delay 840ms */}
          <p className="animate-es-fade-up mt-4 text-xs tracking-widest text-slate-600 uppercase" style={{ animationDelay: '840ms' }}>
            Backed by Redis Distributed Locking · Inngest Workflows · Real-time Pusher Events
          </p>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 2 — THE PROBLEM                                             */}
      {/* Animation: cards SWEEP IN FROM THE LEFT (fade-left) with stagger.  */}
      {/* ================================================================== */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        {/* Section header fades up */}
        <AnimateOnScroll variant="fade-up" className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-red-400 uppercase">The Problem</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">Managing products across platforms is a nightmare.</h2>
          <p className="max-w-xl text-slate-500">Every time you update a price, adjust stock, or change a product description — you have to log into three different dashboards and do it three times. Manually. One mistake means your Amazon listing shows the old price while Shopify is already sold out.</p>
        </AnimateOnScroll>

        {/* Pain cards — each sweeps from the left with a stagger */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((text, i) => (
            <AnimateOnScroll key={text} variant="fade-left" delay={i * 90}>
              <PainCard text={text} />
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 3 — THE SOLUTION (Hub-and-Spoke)                           */}
      {/* Animation: left column → fade-left, hub → scale-in,               */}
      {/*            right column → fade-right, bullets → pop-in stagger.   */}
      {/* ================================================================== */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <AnimateOnScroll variant="fade-up" className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-indigo-400 uppercase">The Solution</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">EcomSync is your single source of truth.</h2>
          <p className="max-w-xl text-slate-500">Update once in EcomSync. Our sync engine instantly fans out the change to every connected platform — with automatic retries, distributed locking, and a full immutable audit log of every inventory event.</p>
        </AnimateOnScroll>

        {/* Hub-and-spoke diagram */}
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-0">
          {/* Left — platforms sweep in from left */}
          <AnimateOnScroll variant="fade-left" delay={0} className="flex flex-col gap-4 md:mr-8">
            {[
              { label: 'Shopify', color: '#96BF48', icon: '🛍' },
              { label: 'Amazon', color: '#FF9900', icon: '📦' },
              { label: 'WooCommerce', color: '#7F54B3', icon: '🛒' },
            ].map((p) => (
              <div
                key={p.label}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium"
                style={{
                  borderColor: `${p.color}30`,
                  backgroundColor: `${p.color}0D`,
                  color: p.color,
                }}>
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </AnimateOnScroll>

          {/* Connector lines — left */}
          <div className="hidden flex-col items-end gap-[26px] md:flex">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center">
                <div className="h-px w-12 bg-linear-to-r from-slate-700 to-indigo-600/60" />
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </div>
            ))}
          </div>

          {/* Hub — scales in from centre */}
          <AnimateOnScroll variant="scale-in" delay={250}>
            <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-950/60 text-center shadow-xl shadow-indigo-900/40 backdrop-blur-md">
              <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-indigo-600/10 to-violet-600/10" />
              <div className="relative">
                <div className="text-3xl">⚡</div>
                <div className="mt-1 text-xs font-bold tracking-widest text-indigo-300 uppercase">EcomSync</div>
                <div className="text-[10px] text-slate-500">Master Ledger</div>
              </div>
              <div className="absolute inset-0 animate-ping rounded-2xl border border-indigo-500/10" style={{ animationDuration: '3s' }} />
            </div>
          </AnimateOnScroll>

          {/* Connector lines — right */}
          <div className="hidden flex-col items-start gap-[26px] md:flex">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <div className="h-px w-12 bg-linear-to-r from-blue-600/60 to-slate-700" />
              </div>
            ))}
          </div>

          {/* Right — sync outputs sweep in from right */}
          <AnimateOnScroll variant="fade-right" delay={0} className="flex flex-col gap-4 md:ml-8">
            {[
              { label: 'Price Synced', icon: '💰' },
              { label: 'Stock Updated', icon: '📊' },
              { label: 'Info Propagated', icon: '📝' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm font-medium text-blue-300">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </AnimateOnScroll>
        </div>

        {/* Solution bullets — pop-in stagger */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTION_POINTS.map((text, i) => (
            <AnimateOnScroll key={text} variant="pop-in" delay={i * 80}>
              <SolutionCard text={text} />
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 4 — HOW IT WORKS                                           */}
      {/* Animation: step cards FLIP UP in sequence (flip-up + stagger).    */}
      {/* ================================================================== */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <AnimateOnScroll variant="fade-up" className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-violet-400 uppercase">How It Works</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">From one dashboard to all your stores.</h2>
        </AnimateOnScroll>

        {/* Steps cascade with flip-up, 180ms apart */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: 'Step 01',
              title: 'Connect Your Stores',
              description: 'Link your Shopify, Amazon, and WooCommerce accounts to EcomSync in minutes. Your existing inventory is imported and becomes the master catalog.',
            },
            {
              step: 'Step 02',
              title: 'Manage from One Place',
              description: 'Update prices, stock levels, descriptions, and images from the EcomSync dashboard. One action, captured in the immutable inventory ledger.',
            },
            {
              step: 'Step 03',
              title: 'Sync Propagates Automatically',
              description: 'Inngest background workflows fan out your change to every connected platform. Failures are retried automatically — with real-time progress via Pusher.',
            },
          ].map(({ step, title, description }, i) => (
            <AnimateOnScroll key={step} variant="flip-up" delay={i * 180}>
              <StepCard step={step} title={title} description={description} />
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 5 — FEATURES GRID                                          */}
      {/* Animation: header scales in, cards POP IN with tight stagger.     */}
      {/* ================================================================== */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <AnimateOnScroll variant="scale-in" className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-blue-400 uppercase">Platform Capabilities</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">Built for reliability at scale.</h2>
          <p className="max-w-xl text-slate-500">EcomSync isn&#39;t just a UI. It&#39;s a resilient distributed system engineered to handle API failures, race conditions, and high-volume concurrent updates without losing a single event.</p>
        </AnimateOnScroll>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <AnimateOnScroll key={feature.title} variant="pop-in" delay={i * 70}>
              <FeatureCard {...feature} />
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6 — CTA                                                    */}
      {/* Animation: whole card does a brightness-bloom GLOW RISE.          */}
      {/* ================================================================== */}
      <section className="relative z-10 px-4 py-32">
        <AnimateOnScroll variant="glow-rise">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-indigo-500/20 bg-linear-to-br from-indigo-950/80 to-violet-950/60 p-12 text-center backdrop-blur-md">
            {/* Glow overlays */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br from-indigo-600/10 via-transparent to-blue-600/10" />
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative">
              <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                Stop updating three dashboards.
                <br />
                <span className="bg-linear-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">Start running one.</span>
              </h2>
              <p className="mb-8 text-slate-400">Connect your stores and let EcomSync handle the rest. One source of truth. Zero manual sync. No more oversells.</p>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-600 px-10 text-sm font-semibold text-white shadow-lg shadow-indigo-900/50 transition-all hover:bg-indigo-500 hover:shadow-indigo-700/40">
                Get Started — It&#39;s Free →
              </Link>
            </div>
          </div>
        </AnimateOnScroll>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="relative z-10 border-t border-white/5 px-4 py-8 text-center">
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} EcomSync · Distributed Inventory Ledger · <span className="text-indigo-700">Built with Next.js, MongoDB, Inngest & Redis</span>
        </p>
      </footer>
    </main>
  );
}
