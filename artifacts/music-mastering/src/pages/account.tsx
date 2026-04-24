import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMe, postCancelSubscription, meQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, CreditCard, Activity, Loader2, Crown } from "lucide-react";
import { useUser } from "@clerk/react";

export function AccountPage() {
  const { user } = useUser();
  const { data: me, isLoading } = useMe();
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleCancel = async () => {
    if (!window.confirm("Cancel your Pro subscription? You'll keep Pro access until the end of the current billing period.")) return;
    setCancelling(true);
    try {
      await postCancelSubscription();
      await qc.invalidateQueries({ queryKey: meQueryKey });
      toast({ title: "Subscription cancelled", description: "You've been moved back to the Free plan." });
    } catch (err: any) {
      toast({ title: "Cancel failed", description: err?.message ?? "Try again later.", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading || !me) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const usage = me.usage;
  const planLabel = me.plan;
  const planStyles: Record<string, string> = {
    free: "bg-muted text-muted-foreground border-border",
    pro: "bg-primary/15 text-primary border-primary/30",
    lifetime: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground mt-1">
          {user?.primaryEmailAddress?.emailAddress}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <CreditCard size={20} className="text-primary" /> Plan
            <Badge variant="outline" className={`${planStyles[planLabel]} text-[10px] uppercase tracking-wider px-2 font-mono ml-1`}>
              {planLabel === "pro" && <Sparkles size={10} className="mr-1" />}
              {planLabel === "lifetime" && <Crown size={10} className="mr-1" />}
              {planLabel}
            </Badge>
          </CardTitle>
          <CardDescription>
            {planLabel === "free" && "3 masters per month."}
            {planLabel === "pro" && (
              <>Unlimited masters. {me.proRenewsAt ? `Renews ${new Date(me.proRenewsAt).toLocaleDateString()}.` : ""}</>
            )}
            {planLabel === "lifetime" && "Unlimited masters forever. Thanks for the support!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {planLabel === "free" && (
            <Button asChild>
              <Link href="/pricing" data-testid="btn-upgrade"><Sparkles size={14} className="mr-2" /> Upgrade</Link>
            </Button>
          )}
          {planLabel === "pro" && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelling} data-testid="btn-cancel">
              {cancelling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelling…</> : "Cancel subscription"}
            </Button>
          )}
          {planLabel !== "free" && (
            <Button asChild variant="outline">
              <Link href="/pricing">Change plan</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Activity size={20} className="text-primary" /> This month
          </CardTitle>
          <CardDescription>Resets on the 1st of each month (UTC).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-4xl font-bold" data-testid="text-usage-count">{usage.monthlyJobs}</span>
            <span className="text-muted-foreground">
              {usage.monthlyJobLimit == null
                ? "masters (unlimited)"
                : `/ ${usage.monthlyJobLimit} masters`}
            </span>
          </div>
          {usage.monthlyJobLimit != null && (
            <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (usage.monthlyJobs / usage.monthlyJobLimit) * 100)}%` }}
              />
            </div>
          )}
          {usage.remaining === 0 && (
            <p className="text-sm text-destructive mt-3">
              You've used all masters for this month.{" "}
              <Link href="/pricing" className="underline font-medium">Upgrade</Link> for unlimited.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
