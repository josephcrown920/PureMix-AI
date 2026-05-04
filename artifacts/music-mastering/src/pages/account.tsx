import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/lib/api";
import { Sparkles, CreditCard, Activity, Loader2, Crown, Zap, Music2 } from "lucide-react";
import { useUser } from "@clerk/react";
import { stagger, fadeUp } from "@/lib/motion";
import { CardCorners } from "@/components/Frame";

const LABEL_NAMES = {
  trial: "No Plan",
  payg: "Pay as you go",
  day: "24-Hour Pass",
  lifetime: "Lifetime",
} as const;

export function AccountPage() {
  const reduce = useReducedMotion();
  const { user } = useUser();
  const { data: me, isLoading } = useMe();

  if (isLoading || !me) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ent = me.entitlement;
  const planLabel = me.plan;
  const planStyles: Record<string, string> = {
    trial: "bg-muted text-muted-foreground border-border",
    payg: "bg-primary/15 text-primary border-primary/30",
    day: "bg-primary/15 text-primary border-primary/30",
    lifetime: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  const dayHoursLeft = ent.dayPassExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(ent.dayPassExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60),
        ),
      )
    : 0;

  return (
    <motion.div
      className="container mx-auto px-4 py-12 max-w-3xl space-y-6"
      initial={reduce ? false : "hidden"}
      animate="visible"
      variants={stagger}
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground mt-1">
          {user?.primaryEmailAddress?.emailAddress}
        </p>
      </motion.div>

      <motion.div variants={fadeUp}>
      <Card className="relative">
        <CardCorners />
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <CreditCard size={20} className="text-primary" /> Plan
            <Badge
              variant="outline"
              className={`${planStyles[planLabel]} text-[10px] uppercase tracking-wider px-2 font-mono ml-1`}
            >
              {planLabel === "lifetime" && <Crown size={10} className="mr-1" />}
              {planLabel === "day" && <Zap size={10} className="mr-1" />}
              {planLabel === "payg" && <Music2 size={10} className="mr-1" />}
              {LABEL_NAMES[planLabel]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {planLabel === "trial" && (
              "No active plan. Buy a master below to get started — $2 per track."
            )}
            {planLabel === "payg" && (
              <>You have <strong>{ent.credits}</strong> master credit{ent.credits === 1 ? "" : "s"} ready to use.</>
            )}
            {planLabel === "day" && (
              <>24-hour pass active. <strong>~{dayHoursLeft}h</strong> remaining for unlimited masters &amp; downloads.</>
            )}
            {planLabel === "lifetime" && "Unlimited masters & downloads forever. Thanks for the support!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/pricing" data-testid="btn-buy-more">
              <Sparkles size={14} className="mr-2" />
              {planLabel === "lifetime" ? "Buy more" : "Buy / top up"}
            </Link>
          </Button>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
      <Card className="relative">
        <CardCorners />
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Activity size={20} className="text-primary" /> Activity
          </CardTitle>
          <CardDescription>Lifetime totals across your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-4xl font-bold" data-testid="text-total-jobs">{me.totalJobs}</span>
            <span className="text-muted-foreground">masters submitted</span>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </motion.div>
  );
}
