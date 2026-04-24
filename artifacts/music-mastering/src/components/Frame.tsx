import React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";

type FrameVariant = "default" | "showcase" | "console" | "subtle";

interface FrameProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: React.ReactNode;
  label?: string;
  badge?: React.ReactNode;
  variant?: FrameVariant;
  animate?: boolean;
  className?: string;
  contentClassName?: string;
}

const variantStyles: Record<FrameVariant, string> = {
  default:
    "border border-border/60 bg-card/40 backdrop-blur-sm shadow-[0_0_24px_-12px_hsl(195_90%_55%/0.35)]",
  showcase:
    "border border-primary/30 bg-gradient-to-br from-card/70 via-card/40 to-card/70 backdrop-blur-md shadow-[0_0_60px_-20px_hsl(195_90%_55%/0.45),inset_0_1px_0_0_hsl(195_90%_70%/0.15)]",
  console:
    "border border-[hsl(35_25%_18%)] bg-gradient-to-b from-[hsl(28_30%_14%)] via-[hsl(25_25%_10%)] to-[hsl(22_22%_8%)] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_0_hsl(35_30%_30%/0.4),inset_0_-2px_4px_-2px_rgba(0,0,0,0.6)]",
  subtle:
    "border border-border/40 bg-card/30 backdrop-blur-sm",
};

const cornerColor: Record<FrameVariant, string> = {
  default: "border-primary/50",
  showcase: "border-primary/70",
  console: "border-[hsl(35_60%_55%)]/70",
  subtle: "border-primary/40",
};

function Corner({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-4 w-4 border-2",
        color,
        className,
      )}
    />
  );
}

export function CardCorners({
  color = "border-primary/40",
  size = "sm",
}: {
  color?: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1.5 top-1.5 border-l-2 border-t-2 rounded-tl",
          color,
          sizeClass,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-1.5 top-1.5 border-r-2 border-t-2 rounded-tr",
          color,
          sizeClass,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1.5 bottom-1.5 border-l-2 border-b-2 rounded-bl",
          color,
          sizeClass,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-1.5 bottom-1.5 border-r-2 border-b-2 rounded-br",
          color,
          sizeClass,
        )}
      />
    </>
  );
}

export function Frame({
  children,
  label,
  badge,
  variant = "default",
  animate = true,
  className,
  contentClassName,
  ...rest
}: FrameProps) {
  const reduce = useReducedMotion();
  const shouldAnimate = animate && !reduce;

  return (
    <motion.div
      initial={shouldAnimate ? "hidden" : false}
      whileInView={shouldAnimate ? "visible" : undefined}
      animate={shouldAnimate ? undefined : "visible"}
      viewport={{ once: true, amount: 0.15 }}
      variants={fadeUp}
      className={cn(
        "relative rounded-xl",
        variantStyles[variant],
        className,
      )}
      {...rest}
    >
      <CardCorners color={cornerColor[variant]} size="md" />

      {(label || badge) && (
        <div className="absolute -top-2.5 left-4 right-4 flex items-center justify-between pointer-events-none">
          {label && (
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-mono rounded-sm pointer-events-auto",
                variant === "console"
                  ? "bg-[hsl(22_22%_8%)] text-[hsl(35_60%_70%)] border border-[hsl(35_25%_25%)]"
                  : "bg-background text-primary border border-primary/40",
              )}
            >
              {label}
            </span>
          )}
          {badge && (
            <span className="ml-auto pointer-events-auto">{badge}</span>
          )}
        </div>
      )}

      <div className={cn("relative", contentClassName)}>{children}</div>
    </motion.div>
  );
}
