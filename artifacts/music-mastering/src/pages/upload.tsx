import React, { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  UploadCloud, FileAudio, Settings2, Loader2, Music, CheckCircle2,
  AlertCircle, Sparkles, ChevronDown, Sliders, Zap, Thermometer,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useCreateMasteringJob, useGetMasteringStats, ApiError, customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatTime, PRESET_LABELS } from "@/lib/format";
import { useMe, meQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Frame } from "@/components/Frame";
import { fadeUp } from "@/lib/motion";

type CreateMasteringJobBodyPreset = "streaming" | "club" | "warm_vinyl" | "broadcast" | "custom";

const PRESET_DEFAULT_LUFS: Record<CreateMasteringJobBodyPreset, number> = {
  streaming: -14,
  club: -7,
  warm_vinyl: -12,
  broadcast: -23,
  custom: -14,
};

function SliderRow({
  label, value, min, max, step = 1, unit = "", onChange, leftLabel, rightLabel,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (v: number) => void;
  leftLabel?: string; rightLabel?: string;
}) {
  const display = value > 0 && unit === "dB" ? `+${value}${unit}` : `${value}${unit}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
        <span className="text-xs font-mono font-semibold text-primary tabular-nums w-14 text-right">{display}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[10px] text-muted-foreground/60 -mt-1">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

export function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<CreateMasteringJobBodyPreset>("streaming");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced controls
  const [targetLufs, setTargetLufs] = useState(-14);
  const [stereoWidth, setStereoWidth] = useState(110);
  const [bassDb, setBassDb] = useState(0);
  const [brightnessDb, setBrightnessDb] = useState(0);
  const [compression, setCompression] = useState<"light" | "medium" | "heavy">("medium");
  const [warmth, setWarmth] = useState(false);
  const [punch, setPunch] = useState(false);

  const { data: stats } = useGetMasteringStats();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const ent = me?.entitlement;
  const limitReached = me != null && ent != null && !ent.allowed;

  // Sync LUFS default when preset changes
  const handlePresetChange = (val: CreateMasteringJobBodyPreset) => {
    setPreset(val);
    setTargetLufs(PRESET_DEFAULT_LUFS[val]);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (isValidAudioFile(f)) setFile(f);
      else toast({ title: "Invalid file type", description: "Please upload an MP3, WAV, or FLAC file.", variant: "destructive" });
    }
  }, [toast]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (isValidAudioFile(f)) setFile(f);
      else toast({ title: "Invalid file type", description: "Please upload an MP3, WAV, or FLAC file.", variant: "destructive" });
    }
  }, [toast]);

  const isValidAudioFile = (f: File) => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-wav', 'audio/aac', 'audio/ogg'];
    const validExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    return validTypes.includes(f.type) || validExtensions.includes(ext);
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("preset", preset);
      formData.append("targetLufs", String(targetLufs));
      formData.append("stereoWidth", String(stereoWidth));
      formData.append("bassDb", String(bassDb));
      formData.append("brightnessDb", String(brightnessDb));
      formData.append("compression", compression);
      if (warmth) formData.append("warmth", "true");
      if (punch) formData.append("punch", "true");

      const result = await customFetch<{ id: number }>("/api/mastering/jobs", {
        method: "POST",
        body: formData,
      });

      toast({ title: "Upload complete", description: "Your track is now being processed." });
      qc.invalidateQueries({ queryKey: meQueryKey });
      setLocation(`/jobs/${result.id}`);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      if (err instanceof ApiError && err.status === 402) {
        const data = err.data as { error?: string } | null;
        toast({ title: "Limit reached", description: data?.error ?? "Upgrade your plan to continue mastering.", variant: "destructive" });
        qc.invalidateQueries({ queryKey: meQueryKey });
        setLocation("/pricing");
        return;
      }
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "There was an error uploading your file. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 py-8 md:py-12 max-w-5xl">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" data-testid="dashboard-stats">
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Music size={14} className="text-primary" /> Total Mastered
            </div>
            <div className="text-2xl font-bold font-mono text-shadow-glow" data-testid="stat-total-jobs">
              {stats?.totalJobs ?? '--'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" /> Completed
            </div>
            <div className="text-2xl font-bold font-mono" data-testid="stat-completed-jobs">
              {stats?.completedJobs ?? '--'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="text-blue-500" /> Processing
            </div>
            <div className="text-2xl font-bold font-mono" data-testid="stat-processing-jobs">
              {stats?.processingJobs ?? '--'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" /> Avg Time
            </div>
            <div className="text-2xl font-bold font-mono" data-testid="stat-avg-time">
              {formatTime(stats?.avgProcessingTimeMs)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-[1fr_380px] gap-8">
        {/* Left: Drop zone + Advanced Controls */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">New Session</h1>
            <p className="text-muted-foreground">Upload your mix. High quality WAV or FLAC recommended.</p>
            {ent && (
              <p className="text-xs text-muted-foreground mt-2 font-mono" data-testid="text-usage">
                {ent.consumeMode === "lifetime" && "Lifetime plan — unlimited masters & downloads."}
                {ent.consumeMode === "day" && "24-hour pass active — unlimited masters & downloads."}
                {ent.consumeMode === "credit" && `${ent.credits} master credit${ent.credits === 1 ? "" : "s"} available.`}
                {ent.consumeMode === "trial" && (
                  <>Starter master — preview only. <Link href="/pricing" className="text-primary hover:underline">Buy to download.</Link></>
                )}
                {!ent.allowed && (
                  <>Starter used. <Link href="/pricing" className="text-primary hover:underline">Buy to keep mastering.</Link></>
                )}
              </p>
            )}
          </div>

          {limitReached && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Your starter master has been used.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pay $2 per master, $10 for 24-hour unlimited, or $200 lifetime.
                  </p>
                </div>
                <Button asChild size="sm" data-testid="btn-upgrade-from-limit">
                  <Link href="/pricing">See plans</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Drop Zone */}
          <Card className={`border-2 border-dashed transition-all duration-200 overflow-hidden ${
            dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/60 bg-card/20 hover:border-border hover:bg-card/40'
          }`}>
            <CardContent className="p-0">
              <div
                className="relative flex flex-col items-center justify-center p-12 text-center min-h-[260px]"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                data-testid="upload-dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,audio/mpeg,audio/wav,audio/flac"
                  onChange={handleChange}
                  data-testid="input-file"
                />
                <AnimatePresence mode="wait" initial={false}>
                  {file ? (
                    <motion.div
                      key="file"
                      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, scale: 0.96, y: -8 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full flex justify-center"
                    >
                      <Frame variant="showcase" label="Uploaded track" animate={false}
                        className="w-full max-w-md"
                        contentClassName="p-6 flex flex-col items-center gap-4"
                      >
                        <motion.div
                          className="p-4 rounded-full bg-primary/20 text-primary ring-2 ring-primary/30 shadow-[0_0_30px_hsl(330_85%_65%/0.4)]"
                          animate={reduce ? undefined : { boxShadow: ["0 0 20px hsl(330 85% 65% / 0.3)","0 0 40px hsl(330 85% 65% / 0.5)","0 0 20px hsl(330 85% 65% / 0.3)"] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <FileAudio size={48} strokeWidth={1.5} />
                        </motion.div>
                        <div className="text-center">
                          <h3 className="text-lg font-medium font-mono break-all" data-testid="text-uploaded-filename">
                            {file.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <div className="flex items-end gap-1 h-6" aria-hidden>
                          {Array.from({ length: 18 }).map((_, i) => (
                            <span key={i} className="w-1 rounded-full bg-gradient-to-t from-primary/40 to-primary animate-equalize"
                              style={{ height: "100%", animationDelay: `${(i % 6) * 0.1}s`, animationDuration: `${0.7 + (i % 4) * 0.18}s` }} />
                          ))}
                        </div>
                        <Button variant="outline" size="sm"
                          onClick={(e) => { e.stopPropagation(); handleClearFile(); }}
                          className="mt-1 border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                          data-testid="btn-clear-file"
                        >
                          Remove File
                        </Button>
                      </Frame>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-4 pointer-events-none"
                    >
                      <motion.div
                        className={`p-4 rounded-full transition-colors duration-300 ${dragActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                        animate={reduce ? undefined : dragActive ? { scale: [1, 1.08, 1] } : { y: [0, -4, 0] }}
                        transition={{ duration: dragActive ? 0.6 : 2.4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <UploadCloud size={48} strokeWidth={1.5} />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-medium">Click or drag &amp; drop</h3>
                        <p className="text-sm text-muted-foreground mt-1">MP3, WAV, FLAC, AAC, OGG up to 200MB</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Controls Accordion */}
          <Card className="bg-card/60 backdrop-blur border-border/40">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-card/80 transition-colors rounded-xl"
              aria-expanded={showAdvanced}
            >
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-primary" />
                <span className="font-semibold text-sm">Studio Controls</span>
                <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 ml-1">
                  Advanced
                </span>
              </div>
              <motion.div animate={{ rotate: showAdvanced ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} className="text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  key="controls"
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="px-5 pb-5 space-y-6 border-t border-border/30 pt-5">

                    {/* Loudness */}
                    <div>
                      <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-4">Loudness</p>
                      <SliderRow
                        label="Target LUFS"
                        value={targetLufs}
                        min={-23} max={-6} step={0.5} unit=" LUFS"
                        onChange={setTargetLufs}
                        leftLabel="-23 (Broadcast)"
                        rightLabel="-6 (Very Loud)"
                      />
                    </div>

                    {/* Tone */}
                    <div>
                      <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-4">Tone / EQ</p>
                      <div className="space-y-5">
                        <SliderRow
                          label="Bass Enhancement"
                          value={bassDb}
                          min={-6} max={6} step={0.5} unit="dB"
                          onChange={setBassDb}
                          leftLabel="Cut" rightLabel="Boost"
                        />
                        <SliderRow
                          label="Brightness / Air"
                          value={brightnessDb}
                          min={-6} max={6} step={0.5} unit="dB"
                          onChange={setBrightnessDb}
                          leftLabel="Dark" rightLabel="Bright"
                        />
                      </div>
                    </div>

                    {/* Stereo */}
                    <div>
                      <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-4">Stereo Image</p>
                      <SliderRow
                        label="Stereo Width"
                        value={stereoWidth}
                        min={50} max={200} step={5} unit="%"
                        onChange={setStereoWidth}
                        leftLabel="Mono (50%)" rightLabel="Ultra-Wide (200%)"
                      />
                    </div>

                    {/* Compression */}
                    <div>
                      <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-3">Compression</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["light", "medium", "heavy"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setCompression(lvl)}
                            className={`py-2 px-3 rounded-lg border text-xs font-semibold capitalize transition-all ${
                              compression === lvl
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:bg-card/60"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-2">
                        {compression === "light" && "Preserve dynamics. Great for acoustic, jazz, lo-fi."}
                        {compression === "medium" && "Balanced control. Works for most genres."}
                        {compression === "heavy" && "Maximum density. Ideal for Afrobeats, club, trap."}
                      </p>
                    </div>

                    {/* Enhancements */}
                    <div>
                      <p className="text-xs font-bold text-foreground/50 uppercase tracking-widest mb-3">Enhancements</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/30 bg-background/20 hover:bg-background/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <Thermometer size={15} className="text-amber-400" />
                            <div>
                              <p className="text-sm font-medium">Warmth</p>
                              <p className="text-[10px] text-muted-foreground">Analog harmonic saturation — adds richness and vintage feel</p>
                            </div>
                          </div>
                          <Switch checked={warmth} onCheckedChange={setWarmth} />
                        </div>
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/30 bg-background/20 hover:bg-background/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <Zap size={15} className="text-yellow-400" />
                            <div>
                              <p className="text-sm font-medium">Punch</p>
                              <p className="text-[10px] text-muted-foreground">Transient enhancement — tighter kick and snare attack</p>
                            </div>
                          </div>
                          <Switch checked={punch} onCheckedChange={setPunch} />
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>

        {/* Right: Preset + Submit */}
        <div className="flex flex-col">
          <Card className="flex-1 bg-card/60 backdrop-blur border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 size={18} className="text-primary" />
                Mastering Preset
              </CardTitle>
              <CardDescription>
                Choose the target platform standard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preset}
                onValueChange={(val) => handlePresetChange(val as CreateMasteringJobBodyPreset)}
                className="gap-3"
                data-testid="preset-selection"
              >
                {([
                  ["streaming", "Balanced dynamics, perfect for Spotify, Apple Music."],
                  ["club", "Heavy limiting, maximized perceived loudness."],
                  ["warm_vinyl", "Analog warmth, preserved transients, richer low-end."],
                  ["broadcast", "Strict EBU R128 compliance for TV and radio."],
                  ["custom", "Full manual control — adjust every parameter yourself."],
                ] as [CreateMasteringJobBodyPreset, string][]).map(([val, desc]) => (
                  <div key={val} className="relative">
                    <RadioGroupItem value={val} id={val} className="peer sr-only" />
                    <Label
                      htmlFor={val}
                      className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                    >
                      <span className="font-semibold text-base">{PRESET_LABELS[val] ?? val}</span>
                      <span className="text-xs text-muted-foreground font-normal">{desc}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
            <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-3">
              {!showAdvanced && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="w-full text-xs text-primary/70 hover:text-primary transition-colors flex items-center justify-center gap-1.5 py-1"
                >
                  <Sliders size={12} />
                  Open Studio Controls for advanced EQ &amp; effects
                </button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!file || submitting || limitReached}
                className="w-full h-12 text-base font-bold shadow-[0_0_20px_hsl(330_85%_65%/0.2)] hover:shadow-[0_0_28px_hsl(330_85%_65%/0.45)] transition-shadow"
                data-testid="btn-submit-mastering"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending to Studio...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Master Track
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
