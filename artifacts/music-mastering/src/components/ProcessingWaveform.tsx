import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProcessingWaveformProps {
  className?: string;
  bars?: number;
  height?: number;
  label?: string;
}

export function ProcessingWaveform({
  className,
  bars = 64,
  height = 96,
  label,
}: ProcessingWaveformProps) {
  const reduce = useReducedMotion();
  const items = Array.from({ length: bars });

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-[hsl(35_25%_22%)] bg-gradient-to-b from-[hsl(22_22%_6%)] via-[hsl(20_20%_4%)] to-[hsl(22_22%_6%)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_0_24px_rgba(0,0,0,0.7)]",
        className,
      )}
      style={{ height: `${height}px` }}
      data-testid="processing-waveform"
    >
      {/* Bezel highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(35_60%_55%)]/30 to-transparent" />
      {/* Centerline */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[hsl(35_40%_30%)]/30" />

      <div className="relative h-full flex items-center justify-between px-3 gap-[2px]">
        {items.map((_, i) => {
          const seed = (i * 9301 + 49297) % 233280;
          const baseHeight = 22 + (seed % 56);
          const delay = (i % 14) * 0.07;
          const dur = 0.7 + (i % 9) * 0.08;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                "flex-1 rounded-sm bg-gradient-to-t from-[hsl(35_85%_55%)] via-[hsl(38_90%_60%)] to-[hsl(45_95%_70%)] shadow-[0_0_8px_hsl(35_90%_55%/0.4)]",
                !reduce && "animate-mastering-bar",
              )}
              style={{
                height: `${baseHeight}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
              }}
            />
          );
        })}
      </div>

      {/* Scanner sweep */}
      {!reduce && (
        <div
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-[hsl(195_90%_70%)]/25 to-transparent animate-scanner mix-blend-screen"
          aria-hidden
        />
      )}

      {label && (
        <div className="pointer-events-none absolute top-1.5 left-2 text-[9px] font-mono uppercase tracking-[0.2em] text-[hsl(35_60%_70%)]/80">
          {label}
        </div>
      )}
    </div>
  );
}
