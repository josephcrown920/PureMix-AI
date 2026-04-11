import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaveformPlayerProps {
  url: string;
  label: string;
  color?: string;
  progressColor?: string;
  "data-testid"?: string;
}

export function WaveformPlayer({
  url,
  label,
  color = "#374151",
  progressColor = "#f59e0b",
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        Audio unavailable
      </div>
    );
  }

  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <div className="relative">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary/40 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.random() * 40}px`,
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
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 rounded-full border-primary/30 hover:border-primary hover:bg-primary/10"
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 ml-0.5" />
          )}
        </Button>
        <Volume2 className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
