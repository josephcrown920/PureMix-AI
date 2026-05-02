import { useState } from "react";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Sparkles, Zap, Crown, Music2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMe, usePlans, postCheckout, type PlanId } from "@/lib/api";
import { stagger, fadeUp } from "@/lib/motion";
import { CardCorners } from "@/components/Frame";

const PLAN_FEATURES: Record<PlanId, string[]> = {
  single: [
    "1 mastered track",
    "All presets (streaming, club, vinyl, broadcast)",
    "WAV download + email delivery",
    "Tuned for Afrobeats / hip-hop / trap",
  ],
  day: [
    "Unlimited masters for 24 hours",
    "All presets",
    "WAV downloads + email delivery",
    "Best value for batches & EPs",
  ],
  lifetime: [
    "Unlimited masters forever",
    "All current & future presets",
    "WAV downloads + email delivery",
    "One payment. Done.",
  ],
};

const PLAN_ICONS: Record<PlanId, typeof Sparkles> = {
  single: Music2,
  day: Zap,
  lifetime: Crown,
};

export function PricingPage() {
  const reduce = useReducedMotion();
  const { data: plansData } = usePlans();
  const { data: me } = useMe();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const startCheckout = async (plan: PlanId) => {
    if (!me) {
      setLocation("/sign-up");
      return;
    }
    setLoadingPlan(plan);
    try {
      const returnUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/billing/return`;
      const result = await postCheckout({ plan, returnUrl });
      if (result?.authorizationUrl) {
        window.location.href = result.authorizationUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err?.message ?? "Could not start checkout. Please try again.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  };

  const plans = plansData?.plans ?? [];
  const currency = plansData?.currency ?? "USD";

  const fmtPrice = (cents: number) => {
    const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    const symbol = currency === "USD" ? "$" : currency === "NGN" ? "₦" : `${currency} `;
    return `${symbol}${amount}`;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-12">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono mb-4">
          <Sparkles size={12} /> Built for Afrobeats, hip-hop &amp; trap
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple, fair pricing</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Professional AI mastering for Afrobeats, hip-hop &amp; trap.
        </p>
      </div>

      <motion.div
        className="grid md:grid-cols-3 gap-6"
        initial={reduce ? false : "hidden"}
        animate="visible"
        variants={stagger}
      >
        {plans.map((p) => {
          const featured = p.id === "day";
          const Icon = PLAN_ICONS[p.id];
          const features = PLAN_FEATURES[p.id];
          const tagline =
            p.id === "single"
              ? "per master"
              : p.id === "day"
                ? "for 24 hours"
                : "one payment";
          const cornerColor = featured ? "border-primary/70" : "border-primary/35";

          return (
            <motion.div key={p.id} variants={fadeUp}>
            <Card
              className={`relative ${featured ? "border-primary/60 shadow-[0_0_36px_hsl(330_85%_65%/0.18)]" : "border-border/50"} bg-card/60 backdrop-blur-sm hover:translate-y-[-2px] transition-transform`}
              data-testid={`pricing-card-${p.id}`}
            >
              <CardCorners color={cornerColor} />
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground tracking-wider uppercase">
                  Best value
                </div>
              )}
              <CardContent className="p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-2xl flex items-center gap-2">
                      {p.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-md flex items-center justify-center ${featured ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    <Icon size={20} />
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-bold font-mono">{fmtPrice(p.priceCents)}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1 uppercase tracking-wider">{tagline}</div>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => startCheckout(p.id)}
                  disabled={loadingPlan !== null}
                  variant={featured ? "default" : "outline"}
                  className="w-full font-bold"
                  data-testid={`btn-checkout-${p.id}`}
                >
                  {loadingPlan === p.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting…</>
                  ) : (
                    `Buy ${p.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <p className="text-center text-xs text-muted-foreground mt-10">
        Payments processed securely by Paystack. All purchases are one-time —
        nothing auto-renews.
      </p>
    </div>
  );
}
