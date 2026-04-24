import { useState } from "react";
import { useLocation } from "wouter";
import { Show } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMe, usePlans, postCheckout } from "@/lib/api";

export function PricingPage() {
  const { data: plansData } = usePlans();
  const { data: me } = useMe();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const currentPlan = me?.plan;

  const startCheckout = async (plan: "pro" | "lifetime") => {
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

  const fmtPrice = (cents: number, interval: string | null) => {
    const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    const symbol = currency === "USD" ? "$" : currency === "NGN" ? "₦" : `${currency} `;
    if (cents === 0) return "Free";
    if (interval === "month") return `${symbol}${amount}/mo`;
    return `${symbol}${amount}`;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Start free. Upgrade when you're ready to ship.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p: any) => {
          const featured = p.id === "pro";
          const isCurrent = currentPlan === p.id;
          const features =
            p.id === "free"
              ? ["3 masters / month", "All presets", "WAV downloads"]
              : p.id === "pro"
                ? ["Unlimited masters", "All presets", "Priority processing", "Cancel anytime"]
                : ["Unlimited masters forever", "All presets", "Priority processing", "One-time payment"];

          return (
            <Card
              key={p.id}
              className={`relative ${featured ? "border-primary/50 shadow-[0_0_30px_hsl(195_90%_55%/0.15)]" : "border-border/50"} bg-card/60 backdrop-blur-sm`}
              data-testid={`pricing-card-${p.id}`}
            >
              {featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground tracking-wider uppercase">
                  Most popular
                </div>
              )}
              <CardContent className="p-6 flex flex-col gap-5">
                <div>
                  <h3 className="font-bold text-2xl flex items-center gap-2">
                    {p.name}
                    {p.id === "pro" && <Sparkles size={16} className="text-primary" />}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                </div>
                <div className="text-4xl font-bold font-mono">
                  {fmtPrice(p.priceCents, p.interval)}
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {p.id === "free" ? (
                  <Show when="signed-out">
                    <Button asChild variant="outline" className="w-full">
                      <a href="/sign-up">Get started</a>
                    </Button>
                  </Show>
                ) : (
                  <Button
                    onClick={() => startCheckout(p.id)}
                    disabled={loadingPlan !== null || isCurrent}
                    variant={featured ? "default" : "outline"}
                    className="w-full font-bold"
                    data-testid={`btn-checkout-${p.id}`}
                  >
                    {loadingPlan === p.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting…</>
                    ) : isCurrent ? (
                      "Current plan"
                    ) : (
                      `Choose ${p.name}`
                    )}
                  </Button>
                )}
                {p.id === "free" && currentPlan === "free" && (
                  <p className="text-xs text-center text-muted-foreground">You're on the Free plan.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-10">
        Payments processed securely by Paystack.
      </p>
    </div>
  );
}
