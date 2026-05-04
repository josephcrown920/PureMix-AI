import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { useGetMasteringJob, getGetMasteringJobQueryKey, getGetInputFileUrl, getGetOutputFileUrl } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Disc, AudioLines, BarChart3, FastForward, CheckCircle2, AlertTriangle, Sparkles, Lock, Mail, Loader2, Music2, Zap, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { postCheckout, type PlanId } from "@/lib/api";
import { PRESET_LABELS } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { Frame } from "@/components/Frame";
import { ProcessingWaveform } from "@/components/ProcessingWaveform";
import { buttonTap, buttonHover } from "@/lib/motion";

const PROCESSING_STAGES = [
  { threshold: 0, label: "Initializing engine...", icon: Disc },
  { threshold: 20, label: "Analyzing frequencies & dynamics...", icon: BarChart3 },
  { threshold: 40, label: "Applying precise equalization...", icon: AudioLines },
  { threshold: 60, label: "Multi-band compression...", icon: FastForward },
  { threshold: 80, label: "True-peak limiting...", icon: BarChart3 },
  { threshold: 95, label: "Finalizing render...", icon: CheckCircle2 },
  { threshold: 100, label: "Master complete", icon: CheckCircle2 },
];

export function JobPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const reduce = useReducedMotion();
  
  const { data: job, isLoading, error } = useGetMasteringJob(id, {
    query: {
      queryKey: getGetMasteringJobQueryKey(id),
      enabled: !!id,
      refetchInterval: (query) => {
        const currentData = query.state.data;
        if (!currentData) return 2000;
        return (currentData.status === "pending" || currentData.status === "processing") ? 2000 : false;
      }
    }
  });

  const [activeTab, setActiveTab] = useState<"sidebyside" | "original" | "mastered">("sidebyside");
  const [unlocking, setUnlocking] = useState<PlanId | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const startUnlock = async (plan: PlanId) => {
    if (!job) return;
    setUnlocking(plan);
    try {
      const returnUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/billing/return?next=/jobs/${job.id}`;
      const result = await postCheckout({ plan, returnUrl, jobId: plan === "single" ? job.id : undefined });
      if (result?.authorizationUrl) {
        window.location.href = result.authorizationUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err?.message ?? "Try again.", variant: "destructive" });
      setUnlocking(null);
    }
  };

  if (isLoading && !job) {
    return (
      <div className="container mx-auto p-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-8" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container mx-auto p-4 py-8 max-w-4xl">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px] text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Job not found</h2>
            <p className="text-muted-foreground mb-6">We couldn't load the mastering job details.</p>
            <Button asChild variant="outline">
              <Link href="/">Return to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProcessing = job.status === "pending" || job.status === "processing";
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";

  const currentStage = [...PROCESSING_STAGES].reverse().find(s => job.progress >= s.threshold) || PROCESSING_STAGES[0];
  const StageIcon = currentStage.icon;

  const originalUrl = getGetInputFileUrl(job.id);
  const masteredUrl = getGetOutputFileUrl(job.id);

  return (
    <div className="container mx-auto p-4 py-8 max-w-4xl animate-in fade-in duration-500">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3 text-muted-foreground hover:text-foreground">
        <Link href="/" data-testid="link-back-studio">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Studio
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-mono">{job.originalFilename}</h1>
        <div className="flex items-center gap-3 mt-2 text-muted-foreground">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {PRESET_LABELS[job.preset]}
          </span>
          <span className="text-sm">•</span>
          <span className="text-sm">Job #{job.id}</span>
        </div>
      </div>

      {isProcessing && (
        <Frame
          variant="console"
          label="Mastering engine"
          badge={
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[hsl(22_22%_8%)] border border-[hsl(0_60%_45%)]/50 text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(0_75%_65%)]">
              <span className={`h-1.5 w-1.5 rounded-full bg-[hsl(0_75%_55%)] ${reduce ? "" : "animate-pulse"}`} />
              Rec
            </span>
          }
          contentClassName="p-6 md:p-10 flex flex-col gap-6"
        >
          {/* Vintage console header row: stage display + needle meter */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-16 h-16 rounded-full bg-gradient-to-b from-[hsl(28_30%_18%)] to-[hsl(22_22%_10%)] border-2 border-[hsl(35_45%_35%)] flex items-center justify-center shadow-[inset_0_2px_0_0_hsl(35_50%_45%/0.5),inset_0_-2px_4px_rgba(0,0,0,0.5),0_0_20px_hsl(35_85%_55%/0.25)]"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <StageIcon className="h-7 w-7 text-[hsl(35_85%_60%)]" />
              </motion.div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold font-mono text-[hsl(35_70%_85%)]" data-testid="text-processing-stage">
                  {currentStage.label}
                </h2>
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[hsl(35_50%_60%)] mt-1">
                  Engine active • High-resolution audio
                </p>
              </div>
            </div>

            {/* VU-meter style needle gauge */}
            <div className="hidden md:flex flex-col items-center gap-1 min-w-[140px]">
              <div className="relative w-32 h-16 rounded-t-[64px] bg-gradient-to-b from-[hsl(40_50%_88%)] to-[hsl(35_45%_75%)] border border-[hsl(35_25%_25%)] shadow-[inset_0_-4px_8px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.4)] overflow-hidden">
                {/* Scale ticks */}
                {[-30, -15, 0, 15, 30].map((deg, i) => (
                  <span
                    key={i}
                    className={`absolute top-1 left-1/2 origin-bottom h-3 w-px ${i === 4 ? "bg-[hsl(0_70%_45%)]" : "bg-[hsl(25_30%_25%)]"}`}
                    style={{
                      transform: `translateX(-50%) rotate(${deg}deg) translateY(0)`,
                      transformOrigin: "bottom center",
                      bottom: 0,
                      top: "auto",
                      height: "55px",
                    }}
                  />
                ))}
                {/* Needle */}
                <span
                  aria-hidden
                  className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-px h-14 bg-[hsl(0_75%_45%)] shadow-[0_0_4px_hsl(0_75%_45%/0.6)] animate-vu-needle"
                  style={{ transformOrigin: "bottom center" }}
                />
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[hsl(25_30%_15%)] border border-[hsl(35_25%_30%)]" />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[hsl(35_50%_60%)]">VU</span>
            </div>
          </div>

          {/* Animated waveform window */}
          <ProcessingWaveform height={110} bars={72} label="Live audio render" />

          {/* Progress bar styled as console fader/track */}
          <div className="flex items-center gap-4 px-1">
            <span className="text-sm font-mono font-medium text-[hsl(35_85%_60%)] w-12 text-right tabular-nums">
              {job.progress}%
            </span>
            <div className="flex-1 h-2 rounded-full bg-[hsl(22_22%_6%)] border border-[hsl(35_25%_22%)] overflow-hidden shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(35_85%_50%)] via-[hsl(40_90%_60%)] to-[hsl(45_95%_65%)] shadow-[0_0_10px_hsl(35_90%_55%/0.7)]"
                initial={false}
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                data-testid="progress-bar"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i * 33 <= job.progress
                      ? "bg-[hsl(35_85%_55%)] shadow-[0_0_4px_hsl(35_85%_55%/0.7)]"
                      : "bg-[hsl(35_25%_22%)]"
                  }`}
                />
              ))}
            </div>
          </div>
        </Frame>
      )}

      {isFailed && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-destructive">Mastering Failed</h2>
            <p className="text-muted-foreground max-w-md mb-8">{job.errorMessage || "An unknown error occurred during processing."}</p>
            <Button asChild variant="destructive">
              <Link href="/">Try Another File</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isCompleted && (
        <div className="grid gap-6">
          {/* Master Complete — showcase frame */}
          <Frame
            variant="showcase"
            label="Master Complete"
            badge={
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
                <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${reduce ? "" : "animate-pulse"}`} />
                Ready
              </span>
            }
            contentClassName="p-6 flex flex-col gap-5"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-sm">
                  Your track has been professionally mastered and is ready.
                </p>
              </div>
              {job.downloadUnlocked ? (
                <motion.a
                  href={`${masteredUrl}${masteredUrl.includes("?") ? "&" : "?"}download=1`}
                  download={`Mastered_${job.originalFilename}`}
                  data-testid="btn-download"
                  whileHover={reduce ? undefined : { ...buttonHover, scale: 1.02 }}
                  whileTap={reduce ? undefined : buttonTap}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm bg-primary text-primary-foreground shadow-[0_0_15px_hsl(270_85%_68%/0.35)] hover:shadow-[0_0_28px_hsl(270_85%_68%/0.60)] transition-shadow"
                >
                  <Download className="h-5 w-5" /> Download WAV
                </motion.a>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-medium" data-testid="badge-preview-only">
                  <Lock size={14} /> Preview only — pay to download
                </div>
              )}
            </div>

            {/* Metric panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Frame variant="subtle" label="Input loudness" contentClassName="p-4 flex justify-between items-center" animate={false}>
                <div className="flex flex-col">
                  <span className="text-lg font-mono">{job.measuredInputLufs?.toFixed(1) || "--"} LUFS</span>
                </div>
                <AudioLines className="text-muted-foreground/30 h-8 w-8" />
              </Frame>
              <Frame variant="showcase" label="Master loudness" contentClassName="p-4 flex justify-between items-center" animate={false}>
                <div className="flex flex-col">
                  <span className="text-lg font-mono text-primary font-bold">{job.measuredOutputLufs?.toFixed(1) || "--"} LUFS</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Target</span>
                  <span className="text-sm font-mono text-muted-foreground">{job.targetLufs || "--"}</span>
                </div>
              </Frame>
            </div>
          </Frame>

          {/* A/B Waveform Comparison */}
          <Frame variant="subtle" label="A/B Comparison" contentClassName="p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <AudioLines className="h-4 w-4 text-primary" />
                A/B Waveform Comparison
              </p>
              <div className="flex items-center p-1 bg-background rounded-md border border-border text-xs font-medium">
                <button
                  className={`px-3 py-1 rounded transition-colors ${activeTab === "sidebyside" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("sidebyside")}
                  data-testid="tab-sidebyside"
                >
                  Side by Side
                </button>
                <button
                  className={`px-3 py-1 rounded transition-colors ${activeTab === "original" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("original")}
                  data-testid="tab-original"
                >
                  Original
                </button>
                <button
                  className={`px-3 py-1 rounded transition-colors ${activeTab === "mastered" ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab("mastered")}
                  data-testid="tab-mastered"
                >
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Mastered
                  </span>
                </button>
              </div>
            </div>

            {activeTab === "sidebyside" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="waveform-sidebyside">
                <Frame variant="subtle" label="Original" contentClassName="p-4">
                  <WaveformPlayer
                    url={originalUrl}
                    label="Original Mix"
                    color="#4b5563"
                    progressColor="#9ca3af"
                    accent="neutral"
                    data-testid="waveform-original"
                  />
                </Frame>
                <Frame variant="showcase" label="AI Master" contentClassName="p-4">
                  <WaveformPlayer
                    url={masteredUrl}
                    label="AI Master"
                    color="#92400e"
                    progressColor="#f59e0b"
                    accent="primary"
                    data-testid="waveform-mastered"
                  />
                </Frame>
              </div>
            )}

            {activeTab === "original" && (
              <div data-testid="waveform-original-solo">
                <Frame variant="subtle" label="Original" contentClassName="p-4">
                  <WaveformPlayer
                    url={originalUrl}
                    label="Original Mix"
                    color="#4b5563"
                    progressColor="#9ca3af"
                    accent="neutral"
                    data-testid="waveform-original"
                  />
                </Frame>
              </div>
            )}

            {activeTab === "mastered" && (
              <div data-testid="waveform-mastered-solo">
                <Frame variant="showcase" label="AI Master" contentClassName="p-4">
                  <WaveformPlayer
                    url={masteredUrl}
                    label="AI Master"
                    color="#92400e"
                    progressColor="#f59e0b"
                    accent="primary"
                    data-testid="waveform-mastered"
                  />
                </Frame>
              </div>
            )}

            <p className="text-xs text-muted-foreground/60 mt-4 text-center">
              Click on the waveform to seek • Play both tracks to compare the difference
            </p>
          </Frame>

          {!job.downloadUnlocked && (
            <Frame
              variant="showcase"
              label="Unlock download"
              badge={
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/30 text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
                  <Lock size={8} /> Locked
                </span>
              }
              contentClassName="p-6 flex flex-col gap-5"
              data-testid="paywall-card"
            >
              <div>
                <p className="text-muted-foreground text-sm">
                  Your master is ready to preview. Pick an option below to download the high-resolution WAV and have it emailed to you.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <motion.div
                  whileHover={reduce ? undefined : buttonHover}
                  whileTap={reduce ? undefined : buttonTap}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto flex flex-col items-start gap-1 p-4 text-left border-border/60 hover:border-primary/60"
                    onClick={() => startUnlock("single")}
                    disabled={unlocking !== null}
                    data-testid="btn-unlock-single"
                  >
                    {unlocking === "single" ? (
                      <Loader2 className="h-4 w-4 animate-spin self-center" />
                    ) : (
                      <>
                        <span className="flex items-center gap-2 text-sm font-bold"><Music2 size={14} /> Just this one</span>
                        <span className="text-2xl font-mono font-bold">$2</span>
                        <span className="text-[11px] text-muted-foreground">Unlock + email this master</span>
                      </>
                    )}
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={reduce ? undefined : buttonHover}
                  whileTap={reduce ? undefined : buttonTap}
                >
                  <Button
                    className="w-full h-auto flex flex-col items-start gap-1 p-4 text-left shadow-[0_0_18px_hsl(270_85%_68%/0.28)]"
                    onClick={() => startUnlock("day")}
                    disabled={unlocking !== null}
                    data-testid="btn-unlock-day"
                  >
                    {unlocking === "day" ? (
                      <Loader2 className="h-4 w-4 animate-spin self-center" />
                    ) : (
                      <>
                        <span className="flex items-center gap-2 text-sm font-bold"><Zap size={14} /> 24-hour pass</span>
                        <span className="text-2xl font-mono font-bold">$10</span>
                        <span className="text-[11px] opacity-80">Unlimited masters &amp; downloads</span>
                      </>
                    )}
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={reduce ? undefined : buttonHover}
                  whileTap={reduce ? undefined : buttonTap}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto flex flex-col items-start gap-1 p-4 text-left border-amber-500/40 hover:border-amber-500/80 hover:bg-amber-500/10"
                    onClick={() => startUnlock("lifetime")}
                    disabled={unlocking !== null}
                    data-testid="btn-unlock-lifetime"
                  >
                    {unlocking === "lifetime" ? (
                      <Loader2 className="h-4 w-4 animate-spin self-center" />
                    ) : (
                      <>
                        <span className="flex items-center gap-2 text-sm font-bold text-amber-400"><Crown size={14} /> Lifetime</span>
                        <span className="text-2xl font-mono font-bold">$200</span>
                        <span className="text-[11px] text-muted-foreground">Forever, all masters</span>
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Mail size={12} /> After payment we'll email the WAV to your account email and unlock the download here.
              </p>
            </Frame>
          )}

          {job.downloadUnlocked && (
            <Frame variant="subtle" contentClassName="p-4 flex items-center gap-3 text-sm" data-testid="email-card">
              <Mail size={16} className="text-emerald-400" />
              <span>We've also emailed a download link to your account email.</span>
            </Frame>
          )}
        </div>
      )}
    </div>
  );
}
