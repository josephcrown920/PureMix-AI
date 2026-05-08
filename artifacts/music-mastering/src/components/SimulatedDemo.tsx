import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Upload,
  AudioLines,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Download,
  Volume2,
  Disc3,
} from "lucide-react";

type Phase = 0 | 1 | 2 | 3;

const PHASE_DURATION_MS = 3200;

const PHASES: { label: string; sub: string; icon: typeof Upload }[] = [
  { label: "Upload your mix", sub: "track.wav · 24-bit · 48kHz", icon: Upload },
  { label: "Chat with the AI engineer", sub: "\"warm it up, harder 808s\"", icon: MessageSquare },
  { label: "Mastering in real time", sub: "EQ · Comp · Limit · Stereo", icon: AudioLines },
  { label: "Preview & download WAV", sub: "+8.2 LUFS · -1.0 dBTP", icon: Download },
];

const BARS = Array.from({ length: 36 });

/**
 * SimulatedDemo: a self-contained "video-like" mockup that loops through the
 * four product stages. Pure CSS/SVG — no media file, no network calls.
 */
export function SimulatedDemo() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setPhase((p) => (((p + 1) % 4) as Phase));
    }, PHASE_DURATION_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div
      className="relative rounded-2xl border border-primary/30 bg-[hsl(265_38%_8%)] overflow-hidden shadow-[0_0_60px_-10px_hsl(270_85%_68%/0.5)]"
      data-testid="simulated-demo"
      role="img"
      aria-label="Animated demo of the Puremix.ai mastering flow"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-primary/15 bg-[hsl(265_38%_6%)]">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">
          puremix.ai / studio
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE DEMO
        </span>
      </div>

      <div className="relative h-[320px] sm:h-[360px]">
        {/* Ambient halo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 left-1/4 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-16 right-1/4 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        </div>

        {/* Phase content */}
        <AnimatePresence mode="wait">
          {phase === 0 && <UploadScene key="0" />}
          {phase === 1 && <ChatScene key="1" />}
          {phase === 2 && <MasteringScene key="2" />}
          {phase === 3 && <DownloadScene key="3" />}
        </AnimatePresence>

        {/* Caption strip */}
        <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-[hsl(265_40%_5%)] to-transparent">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div className="h-9 w-9 rounded-md bg-primary/20 text-primary flex items-center justify-center ring-1 ring-primary/40 shrink-0">
                {(() => {
                  const Icon = PHASES[phase].icon;
                  return <Icon size={16} />;
                })()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight" style={{ fontFamily: "var(--app-font-display)" }}>
                  {PHASES[phase].label}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {PHASES[phase].sub}
                </div>
              </div>
              <div className="ml-auto flex gap-1" aria-hidden>
                {PHASES.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === phase ? "w-6 bg-primary" : "w-1.5 bg-primary/25"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function UploadScene() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 flex items-center justify-center p-8"
    >
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 18 }}
        className="w-full max-w-sm rounded-xl border-2 border-dashed border-primary/40 bg-card/40 p-6 text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center ring-2 ring-primary/30 mb-3">
          <Upload size={22} />
        </div>
        <div className="text-sm font-semibold">track.wav</div>
        <div className="text-[11px] font-mono text-muted-foreground mt-1">8.4 MB · uploading…</div>
        <div className="mt-3 h-1.5 rounded-full bg-primary/15 overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.4, ease: "easeOut" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChatScene() {
  const bubbles = [
    { who: "user", text: "Make it warmer and harder 808s." },
    { who: "ai", text: "Got it — switching to Warm Vinyl + boosting low-end punch." },
    { who: "user", text: "Refs?" },
    { who: "ai", text: "Try Burna Boy — Last Last · WizKid — Essence" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md flex flex-col gap-2">
        {bubbles.map((b, i) => (
          <motion.div
            key={i}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.45, duration: 0.3 }}
            className={`flex ${b.who === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-snug ${
                b.who === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card/80 border border-border/50 text-foreground rounded-bl-sm"
              }`}
            >
              {b.text}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function MasteringScene() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6"
    >
      {/* Animated EQ bars */}
      <div className="flex items-end justify-center gap-1 h-24" aria-hidden>
        {BARS.map((_, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-primary/40 to-primary"
            initial={{ height: 8 }}
            animate={{ height: [10, 60 + ((i * 7) % 40), 18, 80 - ((i * 5) % 30), 24] }}
            transition={{
              duration: 1.2 + (i % 5) * 0.15,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i % 7) * 0.07,
            }}
          />
        ))}
      </div>

      {/* Knob row */}
      <div className="flex items-center justify-center gap-5">
        {[
          { label: "LOW", from: -160 },
          { label: "MID", from: -40 },
          { label: "HI", from: 80 },
        ].map((k) => (
          <div key={k.label} className="flex flex-col items-center gap-1.5">
            <motion.div
              className="relative h-12 w-12 rounded-full bg-card border border-primary/40 ring-2 ring-primary/20 shadow-[0_0_18px_hsl(270_85%_68%/0.45)]"
              animate={{ rotate: [k.from, k.from + 90, k.from + 30] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="absolute top-1 left-1/2 -translate-x-1/2 h-3 w-0.5 rounded-full bg-primary" />
            </motion.div>
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Status pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/30 text-[11px] font-mono">
        <Sparkles size={11} className="animate-pulse" />
        MASTERING — 67%
      </div>
    </motion.div>
  );
}

function DownloadScene() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
    >
      {/* A/B waveform compare */}
      <div className="w-full max-w-md space-y-2">
        <WavePair label="ORIGINAL" amp={0.45} color="muted" />
        <WavePair label="MASTERED" amp={0.95} color="primary" glow />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 18 }}
        className="flex items-center gap-3"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <CheckCircle2 size={13} /> +8.2 LUFS · -1.0 dBTP
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold shadow-[0_0_24px_hsl(270_85%_68%/0.6)]">
          <Download size={13} /> Download WAV
        </div>
      </motion.div>
    </motion.div>
  );
}

function WavePair({
  label,
  amp,
  color,
  glow,
}: {
  label: string;
  amp: number;
  color: "muted" | "primary";
  glow?: boolean;
}) {
  const stroke = color === "primary" ? "hsl(270 85% 68%)" : "hsl(270 10% 50%)";
  const path =
    "M0 20 " +
    Array.from({ length: 60 })
      .map((_, i) => {
        const x = (i + 1) * 4;
        const y = 20 + Math.sin(i * 0.7) * (amp * 14) + (i % 3 === 0 ? -2 : 2) * amp;
        return `L ${x} ${y}`;
      })
      .join(" ");
  return (
    <div className="flex items-center gap-3">
      <span className="text-[9px] font-mono tracking-[0.18em] text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <svg
        viewBox="0 0 240 40"
        className={`flex-1 h-7 ${glow ? "drop-shadow-[0_0_6px_hsl(270_85%_68%/0.7)]" : ""}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={path} stroke={stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-primary/70" aria-hidden>
        {color === "primary" ? <Volume2 size={13} /> : <Disc3 size={13} />}
      </span>
    </div>
  );
}
