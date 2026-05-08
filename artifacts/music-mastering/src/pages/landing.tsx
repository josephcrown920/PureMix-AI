import { useEffect, useState, useId } from "react";
import { SimulatedDemo } from "@/components/SimulatedDemo";
import { Link } from "wouter";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fadeUp, fadeUpLarge, staggerSlow } from "@/lib/motion";
import {
  Sparkles,
  Waves,
  Zap,
  AudioLines,
  CheckCircle2,
  XCircle,
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
  Upload,
  Wand2,
  Download,
  ShieldCheck,
  Clock,
  Users,
  ChevronDown,
  X,
  MessageSquare,
  FileText,
  Music3,
  Gauge,
  Layers,
  Volume2,
  Cable,
  CircuitBoard,
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
  { name: "Tayo Adebayo", role: "Afrobeats producer · Lagos", quote: "I've been using expensive studio plug-ins for years. Puremix.ai gave my track that polished streaming-ready sound in 20 seconds flat. My clients can't believe I didn't bounce to a mastering engineer.", stars: 5, avatar: "TA" },
  { name: "Amara Diallo", role: "Amapiano artist · Johannesburg", quote: "The 24-hour pass is insane value. I ran eight tracks through it for $10 — every single one came out sounding massive. The sub bass on amapiano cuts through exactly the way I need.", stars: 5, avatar: "AD" },
  { name: "Kweku Mensah", role: "Hip-hop mixer · Accra", quote: "Side-by-side A/B comparison on the job page sold me immediately. I can hear the exact difference the AI made. Turned a flat rough mix into a radio-ready track.", stars: 5, avatar: "KM" },
  { name: "Funmi Okonkwo", role: "Trap/Afro-trap · Abuja", quote: "Puremix.ai genuinely understands African music. Other AI mastering tools make my trap beats sound washed out — this one preserves the punch and adds that professional sheen.", stars: 5, avatar: "FO" },
  { name: "Siphokazi Dlamini", role: "Afropop vocalist · Cape Town", quote: "The vocals sit perfectly in the mix after mastering. I was worried AI wouldn't handle the bright, forward vocal style I use in afropop, but it actually enhanced it.", stars: 5, avatar: "SD" },
  { name: "DJ Kolade", role: "Club DJ · Nairobi", quote: "Club preset is exactly what I needed. I master my edits right before a set and they hit the system perfectly. $2 per track is nothing compared to what a human engineer charges.", stars: 5, avatar: "DK" },
  { name: "Chinedu Eze", role: "Beat-maker · Port Harcourt", quote: "I sell beats online and the masters from Puremix make my demos stand out instantly. Closed three placements last month I credit directly to better-sounding previews.", stars: 5, avatar: "CE" },
  { name: "Lerato Mokoena", role: "Gqom producer · Durban", quote: "The prompt-mixing chat reads my mind. I describe the track in two words and it picks the right preset every time. Saves me 20 minutes of A/B testing presets.", stars: 5, avatar: "LM" },
  { name: "Ebuka Nwosu", role: "Recording engineer · Enugu", quote: "I bought the lifetime plan after my second master. Already paid for itself ten times over. This is the future of mastering for indie African music.", stars: 5, avatar: "EN" },
];

const FAQS = [
  { q: "Will it work on my genre?", a: "Yes. Puremix.ai is specifically tuned for Afrobeats, amapiano, hip-hop, trap, drill, gqom, and Afropop — but it also handles pop, R&B, EDM, and acoustic well. The AI assistant adapts to whatever you describe." },
  { q: "What file formats can I upload?", a: "MP3, WAV, FLAC, AAC, OGG, and M4A — up to 200 MB per file. We strongly recommend uploading your highest-quality export (24-bit WAV or FLAC) for best results." },
  { q: "How long does mastering take?", a: "Most tracks complete in 20–60 seconds. You'll see live progress on the job page and can preview the result before committing to download." },
  { q: "What about the lyrics transcriber?", a: "Free with any paid master. Once your track is done, hit \"Transcribe lyrics\" on the job page and we'll pull a clean text sheet using state-of-the-art speech-to-text. Perfect for DSP submissions, sync briefs, and lyric videos." },
  { q: "What if the master sounds wrong?", a: "Two safety nets: (1) you can preview every master before paying to download — credits aren't burned until the result lands; (2) if the engine fails for a technical reason on our side, your credit is automatically refunded — no support ticket needed." },
  { q: "Do you keep my audio?", a: "Your audio stays in your account so you can re-download. We don't sell it, share it with third parties, or train AI on it. You can delete any job at any time and the audio is removed from our storage." },
  { q: "Is the 24-hour pass really unlimited?", a: "Yes. Master as many tracks as you want for 24 hours from purchase. Most producers use it to batch-master a full EP or beat pack in one sitting." },
  { q: "Do you offer refunds?", a: "Failed masters are auto-refunded. The Lifetime plan can be refunded within 14 days if you've processed fewer than 10 masters. Successful single masters are non-refundable since you preview before download." },
  { q: "Do I need to be a sound engineer?", a: "Not at all. Pick a preset (or chat with the AI engineer) and hit Master. Power users can fine-tune every DSP parameter via the Total Control panel." },
];

const LYRICS_LINES = [
  "Lights low, sky higher than the airwaves,",
  "808s knockin' through the night, no remake,",
  "Lagos to Joburg, every city know my name,",
  "Mastered by Puremix, can you hear the same?",
  "",
  "[Hook]",
  "We bring the heat — wave after wave,",
  "Pure mix, pure sound, every line we save…",
];

function TypewriterLyrics() {
  const reduce = useReducedMotion();
  const fullText = LYRICS_LINES.join("\n");
  const [count, setCount] = useState(reduce ? fullText.length : 0);

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const total = fullText.length;
    const id = window.setInterval(() => {
      i = (i + 2) % (total + 60);
      setCount(Math.min(i, total));
      if (i >= total + 50) i = 0;
    }, 60);
    return () => window.clearInterval(id);
  }, [fullText, reduce]);

  return (
    <pre
      className="text-xs leading-relaxed font-mono text-foreground whitespace-pre-wrap min-h-[180px]"
      aria-live="polite"
    >
      {fullText.slice(0, count)}
      {!reduce && count < fullText.length && (
        <span className="inline-block w-1.5 h-3 bg-primary align-middle animate-pulse ml-0.5" />
      )}
    </pre>
  );
}

function StarRow({ count, size = 13 }: { count: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={size} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

function GlowStatTile({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: typeof Users;
}) {
  return (
    <div
      className="glow-tile rounded-lg border border-primary/30 bg-card/60 backdrop-blur-sm px-4 py-3 flex items-center gap-3 relative overflow-hidden"
      data-testid={`stat-tile-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/30 shadow-[0_0_18px_hsl(270_85%_68%/0.45)]">
        <Icon size={18} />
      </div>
      <div className="text-left relative z-10">
        <div className="text-xl font-bold font-mono leading-none text-foreground">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
          {label}
        </div>
      </div>
    </div>
  );
}

const SERVICES = [
  {
    icon: AudioLines,
    title: "AI mastering engine",
    body: "Streaming, club, warm-vinyl, and broadcast presets calibrated for African music. Studio-grade EQ, multi-band compression, and true-peak limiting in ~30 seconds.",
    badge: "Core",
  },
  {
    icon: MessageSquare,
    title: "Prompt-mix chat",
    body: "Talk to the AI engineer like a human. \"Make the 808s harder,\" \"warmer top end,\" \"open it up for the club\" — it adjusts settings live, multi-turn.",
    badge: "New",
  },
  {
    icon: Music3,
    title: "Reference song suggestions",
    body: "While you mix, the AI surfaces 2–3 commercial tracks that sound like your vibe so you have a sonic target. One click to open in Spotify.",
    badge: "New",
  },
  {
    icon: FileText,
    title: "Lyrics transcriber",
    body: "Pull a clean lyrics sheet from any master in seconds — using state-of-the-art Whisper STT. Free with every paid master.",
    badge: "Included",
  },
  {
    icon: Layers,
    title: "A/B preview & comparison",
    body: "Side-by-side waveforms with synced playback. Hear the original vs. mastered before you ever pay to download.",
    badge: "Free",
  },
  {
    icon: Sliders,
    title: "Total Control panel",
    body: "Override the AI when you need to. Tune low-shelf, transient attack, stereo width, voice cleanup — every DSP knob is exposed.",
    badge: "Pro",
  },
  {
    icon: Sparkles,
    title: "AI variations",
    body: "Generate 3 master takes (clean, punchy, open) on one upload and pick the one that hits hardest. Great when you're undecided.",
    badge: "1-click",
  },
  {
    icon: ShieldCheck,
    title: "Auto-refund on failure",
    body: "If the engine fails on our side, your credit comes back instantly. No tickets, no waiting. Built-in trust.",
    badge: "Promise",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonId = useId();
  return (
    <div
      className="rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden"
      data-testid={`faq-${q.slice(0, 20)}`}
    >
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-card/60 transition-colors"
      >
        <span className="font-medium text-sm md:text-base">{q}</span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StickyCta() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let frame = 0;
    let ticking = false;
    const update = () => {
      ticking = false;
      setVisible(window.scrollY > 600);
    };
    const handler = () => {
      if (ticking) return;
      ticking = true;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:bottom-6 z-30 max-w-md md:ml-auto"
          data-testid="sticky-cta"
          role="complementary"
          aria-label="Get started call to action"
        >
          <div className="rounded-xl border border-primary/30 bg-background/95 backdrop-blur shadow-[0_8px_40px_-8px_hsl(270_85%_68%/0.5)] pl-4 pr-2 py-3 flex items-center gap-3">
            <div className="hidden sm:flex h-9 w-9 rounded-full bg-primary/15 text-primary items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">Master your first track for $2</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Auto-refund if it fails. Preview before download.
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0 font-bold">
              <Link href="/sign-up" data-testid="btn-sticky-cta">
                Start <ArrowRight size={14} className="ml-1" />
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              data-testid="btn-sticky-dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const EQUIPMENT = [
  { Icon: Headphones, label: "Reference monitors" },
  { Icon: Sliders, label: "EQ & dynamics" },
  { Icon: Mic2, label: "Vocal clarity" },
  { Icon: Disc3, label: "Stereo imaging" },
  { Icon: Speaker, label: "Loudness LUFS" },
  { Icon: Radio, label: "Broadcast ready" },
  { Icon: Gauge, label: "True-peak limiter" },
  { Icon: Volume2, label: "Multi-band comp" },
  { Icon: Cable, label: "Mastering chain" },
  { Icon: CircuitBoard, label: "DSP engine" },
];

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
        <FloatingGear Icon={Gauge} className="right-[40%] top-[10%] hidden lg:block" delay={3.4} rotate={8} size={30} />
        <FloatingGear Icon={CircuitBoard} className="right-[2%] bottom-[36%] hidden lg:block" delay={2.2} rotate={-10} size={36} />

        <div className="container mx-auto px-4 py-20 md:py-24 max-w-6xl relative">
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
                <img src={puremixLogo} alt="Puremix.ai" loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-contain p-1" />
              </div>
            </motion.div>

            <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
              <Sparkles size={12} className="animate-pulse-slow" /> Built for Afrobeats, hip-hop &amp; trap
            </motion.span>
            <motion.h1 variants={fadeUpLarge} className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl">
              Release-ready masters in
              <span className="text-primary"> 30 seconds.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              The AI mastering engine tuned for African music. Chat with the engine, get reference songs,
              and ship a Spotify-ready WAV — for $2.
            </motion.p>

            {/* Aggregate rating row */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <StarRow count={5} size={12} />
                <span className="font-mono text-xs font-semibold text-amber-300">5.0</span>
                <span className="text-xs text-muted-foreground">· loved by African producers</span>
              </div>
            </motion.div>

            {/* Live equalizer */}
            <motion.div variants={fadeUp} className="flex items-end justify-center gap-1 h-12 mt-1" aria-hidden>
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
                    Master my first track <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <motion.div
                whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
              >
                <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                  <a href="#pricing" data-testid="btn-cta-pricing">See pricing</a>
                </Button>
              </motion.div>
            </motion.div>
            <motion.p variants={fadeUp} className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-2">
              <ShieldCheck size={13} className="text-emerald-400" />
              Auto-refund if mastering fails · Preview before you pay to download
            </motion.p>

            {/* Hero stat tiles — glowing */}
            <motion.div
              variants={fadeUp}
              className="grid grid-cols-3 gap-3 mt-4 w-full max-w-2xl"
              data-testid="hero-stats"
            >
              <GlowStatTile value="~30s" label="Avg render" icon={Clock} />
              <GlowStatTile value="$2" label="Per master" icon={Music2} />
              <GlowStatTile value="WAV" label="Studio quality" icon={AudioLines} />
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom waveform marquee */}
        <div className="relative h-20 w-full overflow-hidden border-y border-border/30 bg-card/20">
          <div className="absolute inset-y-0 left-0 w-[200%] flex items-center animate-wave">
            <svg viewBox="0 0 1200 80" className="h-full w-1/2 text-primary/60" preserveAspectRatio="none" aria-hidden>
              <path d="M0 40 Q 30 10, 60 40 T 120 40 T 180 40 T 240 40 T 300 40 T 360 40 T 420 40 T 480 40 T 540 40 T 600 40 T 660 40 T 720 40 T 780 40 T 840 40 T 900 40 T 960 40 T 1020 40 T 1080 40 T 1140 40 T 1200 40" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg viewBox="0 0 1200 80" className="h-full w-1/2 text-primary/60" preserveAspectRatio="none" aria-hidden>
              <path d="M0 40 Q 30 70, 60 40 T 120 40 T 180 40 T 240 40 T 300 40 T 360 40 T 420 40 T 480 40 T 540 40 T 600 40 T 660 40 T 720 40 T 780 40 T 840 40 T 900 40 T 960 40 T 1020 40 T 1080 40 T 1140 40 T 1200 40" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </section>

      {/* PRICING — moved up to be the second thing producers see. */}
      <section id="pricing" className="container mx-auto px-4 py-16 max-w-5xl scroll-mt-20">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono mb-3">
            Simple pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">No subscriptions. No surprises.</h2>
          <p className="text-muted-foreground mt-2">Pay once per track, or unlock unlimited masters.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Single Master", price: "$2", desc: "One track, full WAV download", cta: "Buy now", to: "/pricing", featured: false, perks: ["Lyrics transcribe included", "Preview before pay", "Auto-refund on fail"] },
            { name: "24-Hour Pass", price: "$10", desc: "Unlimited masters for 24h", cta: "Best value", to: "/pricing", featured: true, perks: ["Unlimited tracks", "Unlimited lyrics", "Batch a whole EP"] },
            { name: "Lifetime", price: "$200", desc: "Unlimited forever, one payment", cta: "Buy lifetime", to: "/pricing", featured: false, perks: ["Forever access", "All future features", "14-day refund window"] },
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
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                  <ul className="text-xs text-muted-foreground space-y-1 text-left mx-auto">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" /> {perk}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full mt-auto" variant={p.featured ? "default" : "outline"}>
                    <Link href={p.to} data-testid={`btn-pricing-${p.name.toLowerCase().replace(/\s+/g, "-")}`}>{p.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="text-emerald-400" />
          Auto-refund if a master fails · Lyrics transcribe included on every paid plan
        </div>
      </section>

      {/* SERVICES — what you actually get */}
      <section className="container mx-auto px-4 py-12 max-w-6xl">
        <motion.div
          className="text-center mb-10"
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerSlow}
        >
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20 font-mono mb-3">
            Everything you get
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            A complete mastering studio. In your browser.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Eight pro-grade services bundled into every plan. From AI prompt-mixing to lyrics transcription —
            no extra purchases, no add-ons.
          </motion.p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="services-grid">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={initial}
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.45, delay: (i % 4) * 0.07 } },
              }}
            >
              <div
                className="glow-tile h-full rounded-xl bg-card/60 backdrop-blur-sm p-5 flex flex-col gap-3"
                data-testid={`service-${s.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/30 shadow-[0_0_18px_hsl(270_85%_68%/0.40)]">
                    <s.icon size={18} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
                    {s.badge}
                  </span>
                </div>
                <h3 className="font-bold text-base relative z-10">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed relative z-10">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Equipment showcase — expanded to 10 visuals */}
      <section className="container mx-auto px-4 pb-4 max-w-6xl">
        <div className="text-center mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">
            Studio-grade signal chain
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {EQUIPMENT.map(({ Icon, label }, idx) => (
            <div
              key={label}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border/30 bg-card/30 p-4 backdrop-blur-sm hover:border-primary/40 hover:bg-card/60 hover:shadow-[0_0_20px_hsl(270_85%_68%/0.20)] transition-all"
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

      {/* How it works — 3 steps */}
      <section className="container mx-auto px-4 py-16 max-w-5xl">
        <motion.div
          className="text-center mb-10"
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerSlow}
        >
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono mb-3">
            How it works
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Three steps. Thirty seconds.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mt-2">
            Watch the full flow — upload, chat, master, download — in one loop.
          </motion.p>
        </motion.div>

        {/* Simulated AI demo (no media file, animates the flow live) */}
        <motion.div
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          className="mb-10 max-w-3xl mx-auto"
        >
          <SimulatedDemo />
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] border-t-2 border-dashed border-primary/20" aria-hidden />
          {[
            { icon: Upload, num: "01", title: "Drop your mix", body: "Upload MP3, WAV, or FLAC up to 200 MB. Drag-and-drop or click to browse." },
            { icon: MessageSquare, num: "02", title: "Chat with the AI engineer", body: "Describe what you want, get reference songs, fine-tune in real time. Or skip the chat and pick a preset." },
            { icon: Download, num: "03", title: "Preview, transcribe & download", body: "A/B compare, pull lyrics, then download a Spotify-ready WAV. Hear it before you pay." },
          ].map((s, i) => (
            <motion.div
              key={s.num}
              initial={initial}
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.12 } } }}
              className="relative"
            >
              <Card className="bg-card/60 border-border/40 backdrop-blur-sm hover:border-primary/40 transition-all h-full text-center">
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center ring-4 ring-background">
                      <s.icon size={22} />
                    </div>
                    <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center font-mono">
                      {s.num}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mt-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Button asChild size="lg" className="h-12 px-8 font-bold">
            <Link href="/sign-up" data-testid="btn-cta-howitworks">
              Try it now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* LYRICS SHOWCASE — dedicated visual for the new transcriber */}
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <motion.div
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerSlow}
          className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card/60 via-card/40 to-primary/5 backdrop-blur-sm p-6 md:p-10 grid md:grid-cols-2 gap-8 items-center overflow-hidden"
          data-testid="lyrics-showcase"
        >
          <motion.div variants={fadeUp} className="space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
              <FileText size={11} /> Included free
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Pull the lyrics, instantly.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Every paid master comes with a one-click lyrics transcribe. Hit "Transcribe" on the
              job page and Whisper-class speech-to-text returns a clean text sheet in seconds.
              Perfect for DSP submissions, sync briefs, and lyric videos.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Copy to clipboard or download as <code className="px-1 rounded bg-card/60 font-mono text-[11px]">.txt</code></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Handles English, Pidgin, Yoruba, isiZulu, and more</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Free with any paid master — no add-on fee</li>
            </ul>
            <div className="pt-2">
              <Button asChild size="sm" className="font-semibold">
                <Link href="/sign-up" data-testid="btn-lyrics-cta">
                  Try the transcriber <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Animated lyrics mockup */}
          <motion.div variants={fadeUp} className="relative">
            <div
              className="rounded-xl border border-primary/30 bg-[hsl(265_38%_8%)] p-5 shadow-[0_0_40px_-10px_hsl(270_85%_68%/0.5)]"
              data-testid="lyrics-mockup"
            >
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-primary/15">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                    <FileText size={13} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-none" style={{ fontFamily: "var(--app-font-display)" }}>
                      track.wav
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">2:48 · transcribing…</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> WHISPER
                </span>
              </div>
              <TypewriterLyrics />
              <div className="mt-3 pt-3 border-t border-primary/15 flex items-center gap-2">
                <button className="text-[10px] font-mono px-2 py-1 rounded border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground transition-colors">
                  Copy
                </button>
                <button className="text-[10px] font-mono px-2 py-1 rounded border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground transition-colors">
                  Download .txt
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Comparison table */}
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <motion.div
          className="text-center mb-10"
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerSlow}
        >
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Why not just hire a studio engineer?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mt-2">
            We love studios — for $500 albums. For singles, EPs, and beat packs, the math is brutal.
          </motion.p>
        </motion.div>

        <motion.div
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden"
        >
          <div className="grid grid-cols-4 text-sm">
            <div className="p-4 md:p-5 border-b border-border/40 text-xs uppercase tracking-wider text-muted-foreground font-mono">vs.</div>
            <div className="p-4 md:p-5 border-b border-l border-border/40 text-center"><div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Studio engineer</div></div>
            <div className="p-4 md:p-5 border-b border-l border-border/40 text-center"><div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Generic AI tool</div></div>
            <div className="p-4 md:p-5 border-b border-l border-border/40 text-center bg-primary/10"><div className="text-xs uppercase tracking-wider text-primary font-mono font-bold">Puremix.ai</div></div>

            {[
              { label: "Cost per track", studio: "$50–200", generic: "$5–15", puremix: "$2" },
              { label: "Turnaround", studio: "2–7 days", generic: "1–2 minutes", puremix: "30 seconds" },
              { label: "Tuned for Afrobeats / trap", studio: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" />, generic: <XCircle size={18} className="text-destructive mx-auto" />, puremix: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" /> },
              { label: "Prompt-mix chat", studio: <XCircle size={18} className="text-destructive mx-auto" />, generic: <XCircle size={18} className="text-destructive mx-auto" />, puremix: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" /> },
              { label: "Reference song suggestions", studio: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" />, generic: <XCircle size={18} className="text-destructive mx-auto" />, puremix: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" /> },
              { label: "Lyrics transcribe", studio: <XCircle size={18} className="text-destructive mx-auto" />, generic: <XCircle size={18} className="text-destructive mx-auto" />, puremix: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" /> },
              { label: "Auto-refund on failure", studio: <XCircle size={18} className="text-destructive mx-auto" />, generic: <XCircle size={18} className="text-destructive mx-auto" />, puremix: <CheckCircle2 size={18} className="text-emerald-400 mx-auto" /> },
            ].map((row, i) => (
              <div key={i} className="contents">
                <div className="p-4 md:p-5 border-b border-border/30 last:border-0 text-sm font-medium">{row.label}</div>
                <div className="p-4 md:p-5 border-b border-l border-border/30 last:border-b-0 text-center text-sm text-muted-foreground">{row.studio}</div>
                <div className="p-4 md:p-5 border-b border-l border-border/30 last:border-b-0 text-center text-sm text-muted-foreground">{row.generic}</div>
                <div className="p-4 md:p-5 border-b border-l border-border/30 last:border-b-0 text-center text-sm font-semibold bg-primary/[0.06]">{row.puremix}</div>
              </div>
            ))}
          </div>
        </motion.div>
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
              Trusted by producers across the continent
            </motion.h2>
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 mt-3">
              <StarRow count={5} size={18} />
              <span className="text-sm text-muted-foreground font-mono">· verified user reviews</span>
            </motion.div>
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

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <motion.div
          className="text-center mb-10"
          initial={initial}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerSlow}
        >
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Frequently asked questions
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mt-2">
            Still on the fence? These cover the questions we get most often.
          </motion.p>
        </motion.div>

        <div className="space-y-3" data-testid="faq-list">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Have a different question?{" "}
          <a href="mailto:support@puremix.ai" className="text-primary hover:underline font-medium">
            Email support
          </a>
          .
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
            Join African producers getting radio-ready sound without the studio bill.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-6 flex flex-col sm:flex-row gap-3 justify-center relative">
            <Button asChild size="lg" className="h-12 px-10 text-base font-bold shadow-[0_0_24px_hsl(270_85%_68%/0.40)]">
              <Link href="/sign-up" data-testid="btn-cta-final">
                Master my first track for $2 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs text-muted-foreground mt-4 relative flex items-center justify-center gap-2">
            <ShieldCheck size={13} className="text-emerald-400" />
            Auto-refund if it fails · Preview before download · Lyrics + WAV included
          </motion.p>
        </motion.div>
      </section>

      <StickyCta />
    </div>
  );
}
