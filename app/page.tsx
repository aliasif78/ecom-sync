import LightPillar from '@/components/ui/LightPillar';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Sub-components (co-located — extract to files if they grow)
// ---------------------------------------------------------------------------

/**
 * A subtle animated "ping" badge used for the hero status indicator.
 */
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

/** Platform logo pill shown in the "spokes" of the hub diagram. */
function PlatformPill({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-sm" style={{ borderColor: `${color}40`, backgroundColor: `${color}12`, color }}>
      <span className="text-base">{icon}</span>
      {label}
    </div>
  );
}

/**
 * A single feature card for the feature-grid section.
 */
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

/**
 * A "before" pain-point card for the problem section.
 */
function PainCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
      <span className="mt-0.5 text-red-400">✗</span>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

/**
 * A "after" solution card for the solution section.
 */
function SolutionCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
      <span className="mt-0.5 text-indigo-400">✓</span>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

/**
 * A numbered step for the "How it works" walkthrough.
 */
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
// Page
// ---------------------------------------------------------------------------

/**
 * EcomSync Landing Page
 *
 * Communicates the core value proposition: a single command center that
 * synchronises product inventory across Shopify, Amazon, and WooCommerce in
 * real-time, eliminating the nightmare of manual multi-platform updates.
 */
export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white selection:bg-indigo-500/30">
      {/* ------------------------------------------------------------------ */}
      {/* GLOBAL DECORATIVE LAYER                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Three-tone gradient mesh */}
        <div className="absolute top-0 left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-700/10 blur-[120px]" />
        <div className="absolute top-40 left-[-10%] h-[400px] w-[500px] rounded-full bg-violet-900/15 blur-[100px]" />
        <div className="absolute top-60 right-[-10%] h-[350px] w-[450px] rounded-full bg-blue-900/15 blur-[100px]" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1 — HERO                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        {/* WebGL Pillar — kept from original, tuned to match new palette */}
        <div className="absolute inset-0 z-0 opacity-60">
          <LightPillar topColor="#6366f1" bottomColor="#020617" intensity={0.8} rotationSpeed={0.2} glowAmount={0.0015} pillarWidth={2.5} pillarHeight={0.35} noiseIntensity={0.4} pillarRotation={20} interactive={false} mixBlendMode="screen" quality="medium" />
        </div>

        <div className="relative z-10 flex max-w-4xl flex-col items-center gap-6">
          <StatusBadge />

          {/* Main headline */}
          <h1 className="text-5xl leading-[1.1] font-bold tracking-tight text-balance drop-shadow-2xl md:text-7xl">
            <span className="block text-white">One Update.</span>
            <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">Every Platform.</span>
            <span className="block text-white">Instantly.</span>
          </h1>

          <p className="max-w-2xl text-lg text-balance text-slate-400 md:text-xl">
            EcomSync is the distributed inventory command center that keeps your products perfectly in sync across <span className="font-medium text-slate-300">Shopify</span>, <span className="font-medium text-slate-300">Amazon</span>, and <span className="font-medium text-slate-300">WooCommerce</span> — from a single dashboard, in real-time.
          </p>

          {/* Platform pills */}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <PlatformPill label="Shopify" color="#96BF48" icon="🛍" />
            <PlatformPill label="Amazon" color="#FF9900" icon="📦" />
            <PlatformPill label="WooCommerce" color="#7F54B3" icon="🛒" />
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-600 px-8 text-sm font-semibold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 focus-visible:outline-2 focus-visible:outline-indigo-400">
              Open Dashboard →
            </Link>
            <a href="#how-it-works" className="inline-flex h-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-8 text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10">
              See How It Works
            </a>
          </div>

          {/* Social proof strip */}
          <p className="mt-4 text-xs tracking-widest text-slate-600 uppercase">Backed by Redis Distributed Locking · Inngest Workflows · Real-time Pusher Events</p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2 — THE PROBLEM                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-red-400 uppercase">The Problem</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">Managing products across platforms is a nightmare.</h2>
          <p className="max-w-xl text-slate-500">Every time you update a price, adjust stock, or change a product description — you have to log into three different dashboards and do it three times. Manually. One mistake means your Amazon listing shows the old price while Shopify is already sold out.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {['Change a price on Shopify? Now manually update Amazon and WooCommerce too.', 'Stock runs out on one platform — the other two keep selling, causing oversells.', 'A product description update across 3 platforms takes 30 minutes every time.', 'API failures go unnoticed — your stores silently drift out of sync.', 'No single view of your total inventory across all channels.', 'Race conditions corrupt stock counts when two orders hit simultaneously.'].map((text) => (
            <PainCard key={text} text={text} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3 — THE SOLUTION (HUB & SPOKE VISUAL)                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-indigo-400 uppercase">The Solution</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">EcomSync is your single source of truth.</h2>
          <p className="max-w-xl text-slate-500">Update once in EcomSync. Our sync engine instantly fans out the change to every connected platform — with automatic retries, distributed locking, and a full immutable audit log of every inventory event.</p>
        </div>

        {/* Hub-and-spoke diagram */}
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-0">
          {/* Left spoke — platforms */}
          <div className="flex flex-col gap-4 md:mr-8">
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
          </div>

          {/* Connector arrows — left */}
          <div className="hidden flex-col items-end gap-[26px] md:flex">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-0">
                <div className="h-px w-12 bg-gradient-to-r from-slate-700 to-indigo-600/60" />
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </div>
            ))}
          </div>

          {/* Hub — EcomSync */}
          <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-950/60 text-center shadow-xl shadow-indigo-900/40 backdrop-blur-md md:mx-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600/10 to-violet-600/10" />
            <div className="relative">
              <div className="text-3xl">⚡</div>
              <div className="mt-1 text-xs font-bold tracking-widest text-indigo-300 uppercase">EcomSync</div>
              <div className="text-[10px] text-slate-500">Master Ledger</div>
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 animate-ping rounded-2xl border border-indigo-500/10" style={{ animationDuration: '3s' }} />
          </div>

          {/* Connector arrows — right */}
          <div className="hidden flex-col items-start gap-[26px] md:flex">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-0">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <div className="h-px w-12 bg-gradient-to-r from-blue-600/60 to-slate-700" />
              </div>
            ))}
          </div>

          {/* Right spoke — sync outputs */}
          <div className="flex flex-col gap-4 md:ml-8">
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
          </div>
        </div>

        {/* Solution bullets */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {['Update once — EcomSync propagates to all platforms automatically.', 'Distributed locking ensures no two jobs corrupt the same SKU simultaneously.', 'Automatic retries on API failures mean no silent de-syncs.', 'Full immutable event ledger — every stock change is auditable.', 'Real-time dashboard view of all your inventory across every channel.', 'AI-powered stockout predictions before you run out.'].map((text) => (
            <SolutionCard key={text} text={text} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4 — HOW IT WORKS                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-violet-400 uppercase">How It Works</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">From one dashboard to all your stores.</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StepCard step="Step 01" title="Connect Your Stores" description="Link your Shopify, Amazon, and WooCommerce accounts to EcomSync in minutes. Your existing inventory is imported and becomes the master catalog." />
          <StepCard step="Step 02" title="Manage from One Place" description="Update prices, stock levels, descriptions, and images from the EcomSync dashboard. One action, captured in the immutable inventory ledger." />
          <StepCard step="Step 03" title="Sync Propagates Automatically" description="Inngest background workflows fan out your change to every connected platform. Failures are retried automatically — with real-time progress via Pusher." />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 5 — FEATURES GRID                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-semibold tracking-widest text-blue-400 uppercase">Platform Capabilities</span>
          <h2 className="text-3xl font-bold text-white md:text-4xl">Built for reliability at scale.</h2>
          <p className="max-w-xl text-slate-500">EcomSync isn&#39;t just a UI. It&#39;s a resilient distributed system engineered to handle API failures, race conditions, and high-volume concurrent updates without losing a single event.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon="🔄" title="Real-time Multi-platform Sync" description="Propagate inventory changes to Shopify, Amazon, and WooCommerce the moment they happen — with live progress updates in your dashboard." accent="#6366f1" />
          <FeatureCard icon="🔒" title="Distributed Locking (Redis)" description="Redis-backed locks ensure no two sync workers ever write to the same SKU simultaneously, eliminating race condition data corruption." accent="#8b5cf6" />
          <FeatureCard icon="🔁" title="Automatic Retry Workflows" description="Inngest workflows automatically retry failed platform API calls with exponential backoff — your updates always eventually land." accent="#3b82f6" />
          <FeatureCard icon="📋" title="Immutable Inventory Ledger" description="Every stock movement is recorded as an immutable event (INVENTORY_ADJUSTED, ORDER_CREATED) in MongoDB. Full audit trail, always." accent="#06b6d4" />
          <FeatureCard icon="🤖" title="AI Stockout Predictions" description="Gemini Flash analyses your sales velocity and flags products that are selling too fast before they run out — so you can restock proactively." accent="#10b981" />
          <FeatureCard icon="💬" title="Natural Language Copilot" description='Ask the built-in AI copilot anything: "How many units of SKU-42 are left across all stores?" or "Trigger a manual sync for all Shopify products."' accent="#f59e0b" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 6 — CTA                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative z-10 px-4 py-32">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/80 to-violet-950/60 p-12 text-center backdrop-blur-md">
          {/* Glow */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-600/10 via-transparent to-blue-600/10" />
          <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              Stop updating three dashboards.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">Start running one.</span>
            </h2>
            <p className="mb-8 text-slate-400">Connect your stores and let EcomSync handle the rest. One source of truth. Zero manual sync. No more oversells.</p>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-600 px-10 text-sm font-semibold text-white shadow-lg shadow-indigo-900/50 transition-all hover:bg-indigo-500 hover:shadow-indigo-700/40">
              Get Started — It&#39;s Free →
            </Link>
          </div>
        </div>
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
