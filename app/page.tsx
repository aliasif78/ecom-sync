import LightPillar from '@/components/ui/LightPillar';

export default function Home() {
  return (
    <main className="bg-background selection:bg-primary/30 relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-white">
      {/* Background Layer: WebGL */}
      <div className="absolute inset-0 z-0">
        <LightPillar topColor="#6366f1" bottomColor="#020617" intensity={1} rotationSpeed={0.3} glowAmount={0.002} pillarWidth={3} pillarHeight={0.4} noiseIntensity={0.5} pillarRotation={25} interactive={false} mixBlendMode="screen" quality="medium" />
      </div>

      {/* Content Layer: UI */}
      <div className="z-10 flex max-w-5xl flex-col items-center gap-6 px-4 text-center">
        {/* Status Badge */}
        <div className="border-primary/20 bg-primary/10 text-primary inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium backdrop-blur-md">
          <span className="relative mr-2 flex h-2 w-2">
            <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
            <span className="bg-primary relative inline-flex h-2 w-2 rounded-full"></span>
          </span>
          System Status: Online
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-bold tracking-tight drop-shadow-2xl md:text-7xl">
          <span className="block text-white">EcomSync</span>
          <span className="mt-2 block text-2xl font-light text-slate-400 md:text-4xl">Distributed Inventory Ledger</span>
        </h1>

        <p className="max-w-2xl text-lg text-slate-400 drop-shadow-md md:text-xl">The single source of truth for high-volume e-commerce.</p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <button className="bg-primary hover:bg-primary/90 h-12 rounded-md px-8 font-medium text-white transition-all">Initialize System</button>
        </div>
      </div>
    </main>
  );
}
