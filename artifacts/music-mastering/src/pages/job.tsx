import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetMasteringJob, getGetMasteringJobQueryKey, getGetInputFileUrl, getGetOutputFileUrl } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ArrowLeft, Disc, AudioLines, BarChart3, FastForward, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { PRESET_LABELS } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

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

  const [activePlayer, setActivePlayer] = useState<"original" | "mastered">("mastered");

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
            {/* Visualizer background effect */}
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
                <Button asChild size="lg" className="font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-shadow">
                  <a href={masteredUrl} download={`Mastered_${job.originalFilename}`} data-testid="btn-download">
                    <Download className="mr-2 h-5 w-5" /> Download Master
                  </a>
                </Button>
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

          <Card className="border-border bg-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">A/B Comparison</CardTitle>
                <div className="flex items-center p-1 bg-background rounded-md border border-border">
                  <button 
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activePlayer === "original" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setActivePlayer("original")}
                    data-testid="tab-original"
                  >
                    Original
                  </button>
                  <button 
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activePlayer === "mastered" ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setActivePlayer("mastered")}
                    data-testid="tab-mastered"
                  >
                    Mastered
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className={`transition-all duration-300 ${activePlayer === "original" ? "opacity-100 block" : "opacity-0 hidden"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Original Mix</span>
                </div>
                <div className="bg-background rounded-lg border border-border p-4">
                  {/* Using basic audio tag as requested */}
                  <audio controls className="w-full h-12" src={originalUrl} data-testid="audio-original" />
                </div>
              </div>
              
              <div className={`transition-all duration-300 ${activePlayer === "mastered" ? "opacity-100 block" : "opacity-0 hidden"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Master
                  </span>
                </div>
                <div className="bg-primary/5 rounded-lg border border-primary/30 p-4 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]">
                  <audio autoPlay controls className="w-full h-12" src={masteredUrl} data-testid="audio-mastered" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}