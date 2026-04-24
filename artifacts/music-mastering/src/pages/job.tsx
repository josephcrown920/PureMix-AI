import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetMasteringJob, getGetMasteringJobQueryKey, getGetInputFileUrl, getGetOutputFileUrl } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ArrowLeft, Disc, AudioLines, BarChart3, FastForward, CheckCircle2, AlertTriangle, Sparkles, Lock, Mail, Loader2, Music2, Zap, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { postCheckout, type PlanId } from "@/lib/api";
import { PRESET_LABELS } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { WaveformPlayer } from "@/components/WaveformPlayer";

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
        <Card className="border-primary/20 bg-card shadow-[0_0_30px_rgba(245,158,11,0.05)] overflow-hidden">
          <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center min-h-[400px] relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <div className="w-[120%] h-64 bg-primary/20 blur-3xl rounded-[100%] animate-pulse-slow"></div>
            </div>

            <div className="relative z-10 w-full max-w-md mx-auto text-center flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse-slow">
                <StageIcon className="h-10 w-10 text-primary" />
              </div>
              
              <h2 className="text-2xl font-bold mb-2 font-mono" data-testid="text-processing-stage">{currentStage.label}</h2>
              <p className="text-muted-foreground mb-8 font-mono text-sm">Engine active • Processing high-resolution audio</p>
              
              <div className="w-full flex items-center gap-4">
                <span className="text-sm font-mono font-medium text-primary w-12 text-right">{job.progress}%</span>
                <Progress value={job.progress} className="flex-1 h-2 bg-secondary" indicatorColor="bg-primary shadow-[0_0_10px_rgba(245,158,11,0.5)]" data-testid="progress-bar" />
              </div>
            </div>
          </CardContent>
        </Card>
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
          <Card className="border-emerald-500/20 bg-card overflow-hidden">
            <div className="h-1 w-full bg-emerald-500"></div>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 className="h-5 w-5" /> Master Complete
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Your track has been professionally mastered and is ready.
                  </CardDescription>
                </div>
                {job.downloadUnlocked ? (
                  <Button asChild size="lg" className="font-bold shadow-[0_0_15px_hsl(195_90%_55%/0.3)] hover:shadow-[0_0_25px_hsl(195_90%_55%/0.5)] transition-shadow">
                    <a href={`${masteredUrl}${masteredUrl.includes("?") ? "&" : "?"}download=1`} download={`Mastered_${job.originalFilename}`} data-testid="btn-download">
                      <Download className="mr-2 h-5 w-5" /> Download WAV
                    </a>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-medium" data-testid="badge-preview-only">
                    <Lock size={14} /> Preview only — pay to download
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-background p-4 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Input Loudness</span>
                    <span className="text-lg font-mono">{job.measuredInputLufs?.toFixed(1) || "--"} LUFS</span>
                  </div>
                  <AudioLines className="text-muted-foreground/30 h-8 w-8" />
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex justify-between items-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary/10 pointer-events-none"></div>
                  <div className="flex flex-col relative z-10">
                    <span className="text-xs text-primary uppercase font-bold tracking-wider">Master Loudness</span>
                    <span className="text-lg font-mono text-primary font-bold">{job.measuredOutputLufs?.toFixed(1) || "--"} LUFS</span>
                  </div>
                  <div className="flex flex-col text-right relative z-10">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Target</span>
                    <span className="text-sm font-mono text-muted-foreground">{job.targetLufs || "--"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* A/B Waveform Comparison */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AudioLines className="h-5 w-5 text-primary" />
                  A/B Waveform Comparison
                </CardTitle>
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
            </CardHeader>

            <CardContent className="p-6">
              {activeTab === "sidebyside" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="waveform-sidebyside">
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <WaveformPlayer
                      url={originalUrl}
                      label="Original Mix"
                      color="#4b5563"
                      progressColor="#9ca3af"
                      data-testid="waveform-original"
                    />
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]">
                    <WaveformPlayer
                      url={masteredUrl}
                      label="AI Master"
                      color="#92400e"
                      progressColor="#f59e0b"
                      data-testid="waveform-mastered"
                    />
                  </div>
                </div>
              )}

              {activeTab === "original" && (
                <div className="rounded-lg border border-border bg-background/50 p-4" data-testid="waveform-original-solo">
                  <WaveformPlayer
                    url={originalUrl}
                    label="Original Mix"
                    color="#4b5563"
                    progressColor="#9ca3af"
                    data-testid="waveform-original"
                  />
                </div>
              )}

              {activeTab === "mastered" && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]" data-testid="waveform-mastered-solo">
                  <WaveformPlayer
                    url={masteredUrl}
                    label="AI Master"
                    color="#92400e"
                    progressColor="#f59e0b"
                    data-testid="waveform-mastered"
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground/60 mt-4 text-center">
                Click on the waveform to seek • Play both tracks to compare the difference
              </p>
            </CardContent>
          </Card>

          {!job.downloadUnlocked && (
            <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent" data-testid="paywall-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock size={18} className="text-primary" /> Unlock the download
                </CardTitle>
                <CardDescription>
                  Your master is ready to preview. Pick an option below to download the high-resolution WAV and have it emailed to you.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-auto flex flex-col items-start gap-1 p-4 text-left border-border/60 hover:border-primary/60"
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
                <Button
                  className="h-auto flex flex-col items-start gap-1 p-4 text-left shadow-[0_0_18px_hsl(195_90%_55%/0.25)]"
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
                <Button
                  variant="outline"
                  className="h-auto flex flex-col items-start gap-1 p-4 text-left border-amber-500/40 hover:border-amber-500/80 hover:bg-amber-500/10"
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
              </CardContent>
              <CardContent className="pt-0 pb-6 text-xs text-muted-foreground flex items-center gap-2">
                <Mail size={12} /> After payment we'll email the WAV to your account email and unlock the download here.
              </CardContent>
            </Card>
          )}

          {job.downloadUnlocked && (
            <Card className="border-emerald-500/30 bg-emerald-500/5" data-testid="email-card">
              <CardContent className="p-4 flex items-center gap-3 text-sm">
                <Mail size={16} className="text-emerald-400" />
                <span>We've also emailed a download link to your account email.</span>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
