import React, { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { UploadCloud, FileAudio, Settings2, Loader2, Music, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreateMasteringJob, useGetMasteringStats, ApiError } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatTime, PRESET_LABELS } from "@/lib/format";
import { useMe, meQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Frame } from "@/components/Frame";
import { fadeUp } from "@/lib/motion";
type CreateMasteringJobBodyPreset = "streaming" | "club" | "warm_vinyl" | "broadcast" | "custom";

export function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<CreateMasteringJobBodyPreset>("streaming");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const createJob = useCreateMasteringJob();
  const { data: stats } = useGetMasteringStats();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const ent = me?.entitlement;
  const limitReached = me != null && ent != null && !ent.allowed;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (isValidAudioFile(droppedFile)) {
        setFile(droppedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an MP3, WAV, or FLAC file.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (isValidAudioFile(selectedFile)) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an MP3, WAV, or FLAC file.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const isValidAudioFile = (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-wav'];
    const validExtensions = ['.mp3', '.wav', '.flac'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    return validTypes.includes(file.type) || validExtensions.includes(extension);
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    try {
      const result = await createJob.mutateAsync({
        data: {
          audio: file,
          preset: preset
        }
      });
      
      toast({
        title: "Upload complete",
        description: "Your track is now being processed.",
      });
      
      qc.invalidateQueries({ queryKey: meQueryKey });
      setLocation(`/jobs/${result.id}`);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      if (err instanceof ApiError && err.status === 402) {
        const data = err.data as { error?: string } | null;
        toast({
          title: "Monthly limit reached",
          description: data?.error ?? "Upgrade your plan to continue mastering.",
          variant: "destructive",
        });
        qc.invalidateQueries({ queryKey: meQueryKey });
        setLocation("/pricing");
        return;
      }
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "There was an error uploading your file. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-4 py-8 md:py-12 max-w-5xl">
      {/* Stats Dashboard Row */}
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

      <div className="grid md:grid-cols-[1fr_350px] gap-8">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">New Session</h1>
            <p className="text-muted-foreground">Upload your mix to get started. High quality WAV or FLAC recommended.</p>
            {ent && (
              <p className="text-xs text-muted-foreground mt-2 font-mono" data-testid="text-usage">
                {ent.consumeMode === "lifetime" && "Lifetime plan — unlimited masters & downloads."}
                {ent.consumeMode === "day" && "24-hour pass active — unlimited masters & downloads."}
                {ent.consumeMode === "credit" && `${ent.credits} master credit${ent.credits === 1 ? "" : "s"} available.`}
                {ent.consumeMode === "trial" && (
                  <>Free trial — preview only. <Link href="/pricing" className="text-primary hover:underline">Buy to download.</Link></>
                )}
                {!ent.allowed && (
                  <>Trial used. <Link href="/pricing" className="text-primary hover:underline">Buy to keep mastering.</Link></>
                )}
              </p>
            )}
          </div>
          {limitReached && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">You've used your free trial master.</p>
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

          <Card className={`border-2 border-dashed transition-all duration-200 overflow-hidden ${
            dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/60 bg-card/20 hover:border-border hover:bg-card/40'
          }`}>
            <CardContent className="p-0">
              <div 
                className="relative flex flex-col items-center justify-center p-12 text-center min-h-[300px]"
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
                  accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
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
                      <Frame
                        variant="showcase"
                        label="Uploaded track"
                        animate={false}
                        className="w-full max-w-md"
                        contentClassName="p-6 flex flex-col items-center gap-4"
                      >
                        <motion.div
                          className="p-4 rounded-full bg-primary/20 text-primary ring-2 ring-primary/30 shadow-[0_0_30px_hsl(270_85%_68%/0.45)]"
                          animate={
                            reduce
                              ? undefined
                              : { boxShadow: [
                                  "0 0 20px hsl(270 85% 68% / 0.3)",
                                  "0 0 40px hsl(270 85% 68% / 0.55)",
                                  "0 0 20px hsl(270 85% 68% / 0.3)",
                                ] }
                          }
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
                        {/* Mini equalizer accent */}
                        <div className="flex items-end gap-1 h-6" aria-hidden>
                          {Array.from({ length: 18 }).map((_, i) => (
                            <span
                              key={i}
                              className="w-1 rounded-full bg-gradient-to-t from-primary/40 to-primary animate-equalize"
                              style={{
                                height: "100%",
                                animationDelay: `${(i % 6) * 0.1}s`,
                                animationDuration: `${0.7 + (i % 4) * 0.18}s`,
                              }}
                            />
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearFile();
                          }}
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
                        animate={
                          reduce
                            ? undefined
                            : dragActive
                              ? { scale: [1, 1.08, 1] }
                              : { y: [0, -4, 0] }
                        }
                        transition={{
                          duration: dragActive ? 0.6 : 2.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <UploadCloud size={48} strokeWidth={1.5} />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-medium">Click or drag &amp; drop</h3>
                        <p className="text-sm text-muted-foreground mt-1">MP3, WAV, or FLAC up to 100MB</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col">
          <Card className="flex-1 bg-card/60 backdrop-blur border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 size={18} className="text-primary" />
                Mastering Preset
              </CardTitle>
              <CardDescription>
                Select the target platform standard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={preset} 
                onValueChange={(val) => setPreset(val as CreateMasteringJobBodyPreset)}
                className="gap-3"
                data-testid="preset-selection"
              >
                <div className="relative">
                  <RadioGroupItem value="streaming" id="streaming" className="peer sr-only" />
                  <Label
                    htmlFor="streaming"
                    className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                  >
                    <span className="font-semibold text-base">{PRESET_LABELS["streaming"]}</span>
                    <span className="text-xs text-muted-foreground font-normal">Balanced dynamics, perfect for Spotify, Apple Music.</span>
                  </Label>
                </div>
                
                <div className="relative">
                  <RadioGroupItem value="club" id="club" className="peer sr-only" />
                  <Label
                    htmlFor="club"
                    className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                  >
                    <span className="font-semibold text-base">{PRESET_LABELS["club"]}</span>
                    <span className="text-xs text-muted-foreground font-normal">Heavy limiting, maximized perceived loudness.</span>
                  </Label>
                </div>
                
                <div className="relative">
                  <RadioGroupItem value="warm_vinyl" id="warm_vinyl" className="peer sr-only" />
                  <Label
                    htmlFor="warm_vinyl"
                    className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                  >
                    <span className="font-semibold text-base">{PRESET_LABELS["warm_vinyl"]}</span>
                    <span className="text-xs text-muted-foreground font-normal">Analog warmth, preserved transients, richer low-end.</span>
                  </Label>
                </div>
                
                <div className="relative">
                  <RadioGroupItem value="broadcast" id="broadcast" className="peer sr-only" />
                  <Label
                    htmlFor="broadcast"
                    className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                  >
                    <span className="font-semibold text-base">{PRESET_LABELS["broadcast"]}</span>
                    <span className="text-xs text-muted-foreground font-normal">Strict EBU R128 compliance for TV and radio.</span>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
            <CardFooter className="pt-2 pb-6 px-6">
              <Button 
                onClick={handleSubmit} 
                disabled={!file || createJob.isPending || limitReached} 
                className="w-full h-12 text-base font-bold shadow-[0_0_20px_hsl(270_85%_68%/0.25)] hover:shadow-[0_0_28px_hsl(270_85%_68%/0.50)] transition-shadow"
                data-testid="btn-submit-mastering"
              >
                {createJob.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Initializing Studio...
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