import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { verifyPayment, meQueryKey } from "@/lib/api";

type Status = "verifying" | "success" | "failed";

export function BillingReturnPage() {
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) {
      setStatus("failed");
      setError("No payment reference found in URL.");
      return;
    }
    (async () => {
      try {
        const result: any = await getBillingVerify({ reference });
        if (result?.success) {
          setStatus("success");
          await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        } else {
          setStatus("failed");
          setError(`Payment status: ${result?.status ?? "unknown"}`);
        }
      } catch (err: any) {
        setStatus("failed");
        setError(err?.message ?? "Verification failed");
      }
    })();
  }, [qc]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardContent className="p-8 flex flex-col items-center text-center gap-4">
          {status === "verifying" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <h2 className="text-xl font-bold">Confirming your payment…</h2>
              <p className="text-sm text-muted-foreground">This usually takes just a moment.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h2 className="text-2xl font-bold">You're all set!</h2>
              <p className="text-sm text-muted-foreground">
                Your plan is active. Time to make some masters.
              </p>
              <div className="flex gap-3 mt-2">
                <Button asChild>
                  <Link href="/studio" data-testid="btn-go-studio">Open studio</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/account">View account</Link>
                </Button>
              </div>
            </>
          )}
          {status === "failed" && (
            <>
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-bold">Payment not confirmed</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex gap-3 mt-2">
                <Button asChild>
                  <Link href="/pricing">Try again</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/account">Account</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
