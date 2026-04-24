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
} from "lucide-react";

export function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-20 md:py-32 max-w-5xl relative">
          <div className="flex flex-col items-center text-center gap-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
              <Sparkles size={12} /> AI-powered mastering
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">
              Studio-grade masters,
              <span className="text-primary"> in seconds.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              Upload your mix, pick a target platform, and get a polished, loudness-compliant master ready to release. No plugins. No engineer. Just your sound, perfected.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button asChild size="lg" className="h-12 px-8 text-base font-bold">
                <Link href="/sign-up" data-testid="btn-cta-signup">
                  Start mastering free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                <Link href="/pricing" data-testid="btn-cta-pricing">See pricing</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              3 free masters per month. No credit card required.
            </p>
          </div>
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
            <Card key={f.title} className="bg-card/40 border-border/40 backdrop-blur-sm">
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
            { name: "Free", price: "$0", desc: "3 masters / month", cta: "Get started", to: "/sign-up", featured: false },
            { name: "Pro", price: "$9.99/mo", desc: "Unlimited masters", cta: "Go Pro", to: "/pricing", featured: true },
            { name: "Lifetime", price: "$99", desc: "Pay once, master forever", cta: "Buy lifetime", to: "/pricing", featured: false },
          ].map((p) => (
            <Card
              key={p.name}
              className={`relative ${p.featured ? "border-primary/50 shadow-[0_0_30px_hsl(195_90%_55%/0.15)]" : "border-border/40"} bg-card/60 backdrop-blur-sm`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground tracking-wider uppercase">
                  Most popular
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
