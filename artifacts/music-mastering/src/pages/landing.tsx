import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Waves,
  Zap,
  AudioLines,
  CheckCircle2,
  ArrowRight,
  Headphones,
  Mic2,
  Music2,
  Disc3,
  Radio,
  Sliders,
  Speaker,
  Piano,
  Guitar,
} from "lucide-react";
import puremixLogo from "@/assets/puremix-logo.jpeg";

const EQUALIZER_BARS = Array.from({ length: 28 });

function FloatingGear({
  Icon,
  className,
  delay = 0,
  duration = 6,
  rotate = 0,
  size = 40,
}: {
  Icon: typeof Headphones;
  className?: string;
  delay?: number;
  duration?: number;
  rotate?: number;
  size?: number;
}) {
  return (
    <div
      className={`absolute pointer-events-none animate-float text-primary/40 ${className ?? ""}`}
      style={
        {
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          ["--rot" as string]: `${rotate}deg`,
          transform: `rotate(${rotate}deg)`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <Icon size={size} strokeWidth={1.25} />
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient color blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-glow-pulse" />
          <div
            className="absolute top-20 right-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-glow-pulse"
            style={{ animationDelay: "1.5s" }}
          />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-glow-pulse" style={{ animationDelay: "3s" }} />
        </div>

        {/* Floating musical equipment */}
        <FloatingGear Icon={Headphones} className="left-[6%] top-[18%] hidden md:block" delay={0} rotate={-12} size={56} />
        <FloatingGear Icon={Mic2} className="left-[12%] bottom-[18%] hidden md:block" delay={1.2} rotate={8} size={44} />
        <FloatingGear Icon={Sliders} className="right-[8%] top-[22%] hidden md:block" delay={0.6} rotate={6} size={52} />
        <FloatingGear Icon={Disc3} className="right-[14%] bottom-[14%] hidden md:block" delay={2} rotate={0} size={48} />
        <FloatingGear Icon={Speaker} className="right-[4%] top-[55%] hidden lg:block" delay={1.8} rotate={-6} size={40} />
        <FloatingGear Icon={Piano} className="left-[3%] top-[55%] hidden lg:block" delay={2.4} rotate={4} size={44} />
        <FloatingGear Icon={Guitar} className="left-[20%] top-[8%] hidden lg:block" delay={3} rotate={-18} size={36} />
        <FloatingGear Icon={Radio} className="right-[22%] bottom-[6%] hidden lg:block" delay={1} rotate={10} size={36} />
        <FloatingGear Icon={Music2} className="left-[40%] top-[6%] hidden md:block" delay={2.8} rotate={-4} size={28} />

        <div className="container mx-auto px-4 py-20 md:py-28 max-w-6xl relative">
          <div className="flex flex-col items-center text-center gap-6">
            {/* Animated logo halo */}
            <div className="relative mb-2">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-glow-pulse" />
              <div className="absolute inset-0 rounded-full border border-primary/30 animate-ring-ping" />
              <div
                className="absolute inset-0 rounded-full border border-primary/20 animate-ring-ping"
                style={{ animationDelay: "1.2s" }}
              />
              <div className="absolute -inset-3 rounded-full border border-dashed border-primary/20 animate-spin-slower" />
              <div className="relative h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden ring-2 ring-primary/40 shadow-[0_0_40px_hsl(195_90%_55%/0.55)]">
                <img src={puremixLogo} alt="Puremix.ai" className="h-full w-full object-cover scale-110" />
              </div>
            </div>

            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
              <Sparkles size={12} className="animate-pulse-slow" /> Built for Afrobeats, hip-hop &amp; trap
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">
              The AI mastering engine
              <span className="text-primary"> tuned for African music.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              Drop your Afrobeats, amapiano, hip-hop or trap mix and get a release-ready master in seconds. Preview free. Pay only when you want to download.
            </p>

            {/* Live equalizer */}
            <div className="flex items-end justify-center gap-1 h-12 mt-2" aria-hidden>
              {EQUALIZER_BARS.map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-primary/40 to-primary animate-equalize"
                  style={{
                    height: "100%",
                    animationDelay: `${(i % 7) * 0.12}s`,
                    animationDuration: `${0.7 + (i % 5) * 0.18}s`,
                  }}
                />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Button asChild size="lg" className="h-12 px-8 text-base font-bold shadow-[0_0_24px_hsl(195_90%_55%/0.35)] hover:shadow-[0_0_32px_hsl(195_90%_55%/0.55)] transition-shadow">
                <Link href="/sign-up" data-testid="btn-cta-signup">
                  Start mastering free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                <Link href="/pricing" data-testid="btn-cta-pricing">See pricing</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              1 free trial master. No card required to preview.
            </p>
          </div>
        </div>

        {/* Bottom waveform marquee */}
        <div className="relative h-20 w-full overflow-hidden border-y border-border/30 bg-card/20">
          <div className="absolute inset-y-0 left-0 w-[200%] flex items-center animate-wave">
            <svg viewBox="0 0 1200 80" className="h-full w-1/2 text-primary/60" preserveAspectRatio="none" aria-hidden>
              <path
                d="M0 40 Q 30 10, 60 40 T 120 40 T 180 40 T 240 40 T 300 40 T 360 40 T 420 40 T 480 40 T 540 40 T 600 40 T 660 40 T 720 40 T 780 40 T 840 40 T 900 40 T 960 40 T 1020 40 T 1080 40 T 1140 40 T 1200 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <svg viewBox="0 0 1200 80" className="h-full w-1/2 text-primary/60" preserveAspectRatio="none" aria-hidden>
              <path
                d="M0 40 Q 30 70, 60 40 T 120 40 T 180 40 T 240 40 T 300 40 T 360 40 T 420 40 T 480 40 T 540 40 T 600 40 T 660 40 T 720 40 T 780 40 T 840 40 T 900 40 T 960 40 T 1020 40 T 1080 40 T 1140 40 T 1200 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Equipment showcase strip */}
      <section className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {[
            { Icon: Headphones, label: "Reference monitors" },
            { Icon: Sliders, label: "EQ & dynamics" },
            { Icon: Mic2, label: "Vocal clarity" },
            { Icon: Disc3, label: "Stereo imaging" },
            { Icon: Speaker, label: "Loudness LUFS" },
            { Icon: Radio, label: "Broadcast ready" },
          ].map(({ Icon, label }, idx) => (
            <div
              key={label}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border/30 bg-card/30 p-4 backdrop-blur-sm hover:border-primary/40 hover:bg-card/60 transition-colors"
              data-testid={`gear-${idx}`}
            >
              <Icon
                size={26}
                className="text-primary/80 group-hover:text-primary transition-colors animate-float"
                style={{ animationDelay: `${idx * 0.4}s`, animationDuration: `${5 + idx * 0.3}s` } as React.CSSProperties}
              />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono text-center">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Zap,
              title: "Lightning fast",
              body: "Most tracks complete in under 30 seconds. Iterate freely instead of waiting hours.",
            },
            {
              icon: Waves,
              title: "Platform presets",
              body: "Streaming (-14 LUFS), Club, Warm Vinyl, Broadcast — calibrated for the way listeners actually hear it.",
            },
            {
              icon: AudioLines,
              title: "A/B side-by-side",
              body: "Compare original vs. mastered with synced waveforms. Trust your ears, not your hopes.",
            },
          ].map((f) => (
            <Card
              key={f.title}
              className="bg-card/40 border-border/40 backdrop-blur-sm hover:border-primary/40 hover:shadow-[0_0_24px_hsl(195_90%_55%/0.15)] transition-all"
            >
              <CardContent className="p-6 flex flex-col gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <f.icon size={20} />
                </div>
                <h3 className="font-bold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, fair pricing</h2>
          <p className="text-muted-foreground mt-2">Start free. Upgrade when you ship.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Single Master", price: "$2", desc: "One track, one download", cta: "Buy single", to: "/pricing", featured: false },
            { name: "24-Hour Pass", price: "$10", desc: "Unlimited masters for 24h", cta: "Best value", to: "/pricing", featured: true },
            { name: "Lifetime", price: "$200", desc: "Unlimited forever", cta: "Buy lifetime", to: "/pricing", featured: false },
          ].map((p) => (
            <Card
              key={p.name}
              className={`relative ${p.featured ? "border-primary/50 shadow-[0_0_30px_hsl(195_90%_55%/0.15)]" : "border-border/40"} bg-card/60 backdrop-blur-sm hover:translate-y-[-2px] transition-transform`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground tracking-wider uppercase">
                  Best value
                </div>
              )}
              <CardContent className="p-6 flex flex-col gap-4 text-center">
                <h3 className="font-bold text-xl">{p.name}</h3>
                <div className="text-4xl font-bold font-mono">{p.price}</div>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <CheckCircle2 size={14} className="text-primary" /> {p.desc}
                </p>
                <Button asChild className="w-full" variant={p.featured ? "default" : "outline"}>
                  <Link href={p.to}>{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
