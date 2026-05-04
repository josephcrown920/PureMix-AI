import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fadeUp, fadeUpLarge, staggerSlow } from "@/lib/motion";
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
  Star,
  Quote,
} from "lucide-react";

const puremixLogo = "/puremix-logo-new.png";

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

const TESTIMONIALS = [
  {
    name: "Tayo Adebayo",
    role: "Afrobeats producer · Lagos",
    quote:
      "I've been using expensive studio plug-ins for years. Puremix.ai gave my track that polished streaming-ready sound in 20 seconds flat. My clients can't believe I didn't bounce to a mastering engineer.",
    stars: 5,
    avatar: "TA",
  },
  {
    name: "Amara Diallo",
    role: "Amapiano artist · Johannesburg",
    quote:
      "The 24-hour pass is insane value. I ran eight tracks through it for a $10 — every single one came out sounding massive. The sub bass on amapiano cuts through exactly the way I need.",
    stars: 5,
    avatar: "AD",
  },
  {
    name: "Kweku Mensah",
    role: "Hip-hop mixer · Accra",
    quote:
      "Side-by-side A/B comparison on the job page sold me immediately. I can hear the exact difference the AI made. Turned a flat rough mix into a radio-ready track.",
    stars: 5,
    avatar: "KM",
  },
  {
    name: "Funmi Okonkwo",
    role: "Trap/Afro-trap · Abuja",
    quote:
      "Puremix.ai genuinely understands African music. Other AI mastering tools make my trap beats sound washed out — this one preserves the punch and adds that professional sheen.",
    stars: 5,
    avatar: "FO",
  },
  {
    name: "Siphokazi Dlamini",
    role: "Afropop vocalist · Cape Town",
    quote:
      "The vocals sit perfectly in the mix after mastering. I was worried AI wouldn't handle the bright, forward vocal style I use in afropop, but it actually enhanced it.",
    stars: 5,
    avatar: "SD",
  },
  {
    name: "DJ Kolade",
    role: "Club DJ · Nairobi",
    quote:
      "Club preset is exactly what I needed. I master my edits right before a set and they hit the system perfectly. $2 per track is nothing compared to what a human engineer charges.",
    stars: 5,
    avatar: "DK",
  },
];

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

export function LandingPage() {
  const reduce = useReducedMotion();
  const initial = reduce ? false : "hidden";
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
          <motion.div
            className="flex flex-col items-center text-center gap-6"
            initial={initial}
            animate="visible"
            variants={staggerSlow}
          >
            {/* Animated logo halo */}
            <motion.div className="relative mb-2" variants={fadeUpLarge}>
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-glow-pulse" />
              <div className="absolute inset-0 rounded-full border border-primary/30 animate-ring-ping" />
              <div
                className="absolute inset-0 rounded-full border border-primary/20 animate-ring-ping"
                style={{ animationDelay: "1.2s" }}
              />
              <div className="absolute -inset-3 rounded-full border border-dashed border-primary/20 animate-spin-slower" />
              <div className="relative h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden ring-2 ring-primary/40 shadow-[0_0_40px_hsl(270_85%_68%/0.60)] bg-[hsl(265_40%_7%)]">
                <img src={puremixLogo} alt="Puremix.ai" className="h-full w-full object-contain p-1" />
              </div>
            </motion.div>

            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
              <Sparkles size={12} className="animate-pulse-slow" /> Built for Afrobeats, hip-hop &amp; trap
            </motion.span>
            <motion.h1 variants={fadeUpLarge} className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">
              The AI mastering engine
              <span className="text-primary"> tuned for African music.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              Drop your Afrobeats, amapiano, hip-hop or trap mix and get a release-ready master in seconds. Preview free. Pay only when you want to download.
            </motion.p>

            {/* Live equalizer */}
            <motion.div variants={fadeUp} className="flex items-end justify-center gap-1 h-12 mt-2" aria-hidden>
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
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mt-2">
              <motion.div
                whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
              >
                <Button asChild size="lg" className="h-12 px-8 text-base font-bold shadow-[0_0_24px_hsl(270_85%_68%/0.40)] hover:shadow-[0_0_36px_hsl(270_85%_68%/0.65)] transition-shadow">
                  <Link href="/sign-up" data-testid="btn-cta-signup">
                    Start mastering free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <motion.div
                whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
              >
                <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                  <Link href="/pricing" data-testid="btn-cta-pricing">See pricing</Link>
                </Button>
              </motion.div>
            </motion.div>
            <motion.p variants={fadeUp} className="text-xs text-muted-foreground mt-2">
              1 free trial master. No card required to preview.
            </motion.p>
          </motion.div>
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
        <motion.div
          className="text-center mb-10"
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerSlow}
        >
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">Why producers choose Puremix.ai</motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mt-2">Professional-grade mastering, built around how African music sounds.</motion.p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Zap,
              title: "Lightning fast",
              body: "Most tracks complete in under 30 seconds. Iterate freely instead of waiting hours for a mastering engineer to respond.",
            },
            {
              icon: Waves,
              title: "Platform presets",
              body: "Streaming (-14 LUFS), Club, Warm Vinyl, Broadcast — calibrated for the way listeners actually hear it on Spotify, Apple Music, and club systems.",
            },
            {
              icon: AudioLines,
              title: "A/B side-by-side",
              body: "Compare original vs. mastered with synced waveforms. Trust your ears, not your hopes. Hear every difference the AI made.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={initial}
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } } }}
            >
              <Card className="bg-card/40 border-border/40 backdrop-blur-sm hover:border-primary/40 hover:shadow-[0_0_24px_hsl(270_85%_68%/0.18)] transition-all h-full">
                <CardContent className="p-6 flex flex-col gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <f.icon size={20} />
                  </div>
                  <h3 className="font-bold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 max-w-6xl relative">
          <motion.div
            className="text-center mb-12"
            initial={initial}
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerSlow}
          >
            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono mb-4">
              <Star size={11} className="fill-amber-400" /> Loved by producers across Africa
            </motion.span>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight mt-3">
              Trusted by 1,000+ artists
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground mt-2 max-w-xl mx-auto">
              From bedroom producers to touring artists, Puremix.ai delivers professional sound at a fraction of the cost.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={initial}
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={{
                  hidden: { opacity: 0, y: 28 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: (i % 3) * 0.08 } },
                }}
              >
                <Card className="bg-card/50 border-border/40 backdrop-blur-sm hover:border-primary/30 hover:shadow-[0_0_20px_hsl(270_85%_68%/0.12)] transition-all h-full">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <Quote size={18} className="text-primary/40" />
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.quote}"</p>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {t.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-none">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{t.role}</p>
                        </div>
                      </div>
                      <StarRow count={t.stars} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
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
          ].map((p, i) => (
            <motion.div
              key={p.name}
              initial={initial}
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } } }}
            >
              <Card
                className={`relative ${p.featured ? "border-primary/50 shadow-[0_0_30px_hsl(270_85%_68%/0.20)]" : "border-border/40"} bg-card/60 backdrop-blur-sm hover:translate-y-[-2px] transition-transform h-full`}
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
                  <Button asChild className="w-full mt-auto" variant={p.featured ? "default" : "outline"}>
                    <Link href={p.to}>{p.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="container mx-auto px-4 pb-20 max-w-5xl">
        <motion.div
          className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 backdrop-blur-sm p-10 md:p-14 text-center overflow-hidden"
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerSlow}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(270_85%_68%/0.14),transparent_70%)] pointer-events-none" />
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight relative">
            Your next release deserves<br className="hidden md:block" /> a professional master.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mt-3 max-w-lg mx-auto relative">
            Join thousands of African producers getting radio-ready sound without the studio bill.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-6 flex flex-col sm:flex-row gap-3 justify-center relative">
            <Button asChild size="lg" className="h-12 px-10 text-base font-bold shadow-[0_0_24px_hsl(270_85%_68%/0.40)]">
              <Link href="/sign-up">
                Master your first track free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs text-muted-foreground mt-4 relative">
            No credit card required · 1 free trial master included
          </motion.p>
        </motion.div>
      </section>
    </div>
  );
}
