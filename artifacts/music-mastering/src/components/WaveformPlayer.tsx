import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WaveformPlayerProps {
  url: string;
  label: string;
  color?: string;
  progressColor?: string;
  accent?: "neutral" | "primary";
  "data-testid"?: string;
}

export function WaveformPlayer({
  url,
  label,
  color = "#374151",
  progressColor = "#f59e0b",
  accent = "neutral",
  "data-testid": testId,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 2,
      cursorColor: progressColor,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });

    ws.on("audioprocess", () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    ws.on("error", () => {
      setError(true);
    });

    ws.load(url);

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [url, color, progressColor]);

  const togglePlay = () => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const ledColor = accent === "primary" ? "bg-[hsl(35_95%_60%)]" : "bg-[hsl(35_30%_30%)]";
  const ledShadow =
    accent === "primary"
      ? "shadow-[0_0_8px_hsl(35_95%_60%/0.8)]"
      : "shadow-none";

  if (error) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        Audio unavailable
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className="relative rounded-lg console-plate border border-[hsl(35_25%_22%)] p-4 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6),inset_0_1px_0_0_hsl(35_30%_35%/0.4)]"
    >
      {/* Top bezel: label + LED + tape reels */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("h-2 w-2 rounded-full", ledColor, ledShadow, isPlaying && "animate-pulse")}
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[hsl(35_60%_70%)]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i <= (accent === "primary" ? 2 : 0)
                  ? "bg-[hsl(35_85%_55%)] shadow-[0_0_4px_hsl(35_85%_55%/0.7)]"
                  : "bg-[hsl(35_30%_25%)]",
              )}
            />
          ))}
        </div>
      </div>

      {/* Waveform display window */}
      <div className="relative rounded-md border border-[hsl(35_25%_18%)] bg-gradient-to-b from-[hsl(22_22%_5%)] to-[hsl(20_20%_3%)] p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),inset_0_0_24px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px bg-[hsl(35_40%_30%)]/20" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-[hsl(35_85%_55%)]/60 rounded-full animate-pulse"
                  style={{
                    height: `${20 + (i * 7) % 40}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div
          ref={containerRef}
          className={`w-full transition-opacity duration-300 ${isReady ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      {/* Bottom controls panel */}
      <div className="mt-3 flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "h-9 w-9 p-0 rounded-full border-2 transition-all",
            "bg-gradient-to-b from-[hsl(35_30%_22%)] to-[hsl(28_25%_14%)]",
            "border-[hsl(35_45%_35%)] hover:border-[hsl(35_85%_55%)]",
            "shadow-[inset_0_1px_0_0_hsl(35_50%_45%/0.6),0_2px_4px_rgba(0,0,0,0.5)]",
            "text-[hsl(35_85%_70%)] hover:text-[hsl(35_95%_75%)]",
          )}
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={isPlaying ? "Pause" : "Play"}
          data-testid={testId ? `${testId}-play` : undefined}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 ml-0.5" />
          )}
        </Button>

        {/* Mini VU meter */}
        <div
          className="flex items-end gap-[2px] h-6 px-1.5 rounded border border-[hsl(35_25%_22%)] bg-[hsl(22_22%_5%)] shadow-inner"
          aria-hidden
        >
          {[...Array(10)].map((_, i) => {
            const active = isPlaying && i < 7;
            const tier = i < 6 ? "bg-[hsl(140_60%_50%)]" : i < 8 ? "bg-[hsl(45_90%_55%)]" : "bg-[hsl(0_75%_55%)]";
            return (
              <span
                key={i}
                className={cn(
                  "w-[2px] rounded-sm",
                  active ? tier : "bg-[hsl(35_15%_18%)]",
                  active && "shadow-[0_0_4px_currentColor]",
                )}
                style={{ height: `${30 + i * 7}%` }}
              />
            );
          })}
        </div>

        <Volume2 className="h-3.5 w-3.5 text-[hsl(35_40%_45%)]" />
        <span className="text-xs font-mono text-[hsl(35_55%_65%)] ml-auto tracking-wider">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
