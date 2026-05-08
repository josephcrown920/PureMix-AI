import { Link } from "wouter";

export function RefundsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to home
        </Link>
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">Refund Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: May 8, 2026</p>

      <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">Automatic credit refund on failure</h2>
          <p>
            If a mastering job fails for a technical reason on our side, the credit consumed
            for that job is automatically refunded to your account. You&rsquo;ll see your
            credit balance restored as soon as the job&rsquo;s status flips to{" "}
            <em>failed</em>. No support ticket required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Successful masters</h2>
          <p>
            Once a master finishes successfully and is available for preview, the credit is
            considered consumed. We don&rsquo;t offer refunds for &ldquo;I changed my
            mind&rdquo; or for purely subjective dissatisfaction with the sonic result —
            mastering is creative work, and you can preview the result before downloading.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">24-Hour Pass</h2>
          <p>
            The 24-Hour Pass is non-refundable once activated, since it grants unlimited
            mastering for the window. If the Service is unavailable for more than 4
            consecutive hours during your pass, contact support and we&rsquo;ll extend or
            refund.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Lifetime plan</h2>
          <p>
            The Lifetime plan can be refunded within <strong>14 days</strong> of purchase if
            you have processed fewer than 10 masters. After that, it is non-refundable.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Duplicate / accidental charges</h2>
          <p>
            Got charged twice for the same plan? Email{" "}
            <a href="mailto:support@puremix.ai" className="text-primary hover:underline">
              support@puremix.ai
            </a>{" "}
            with your Paystack reference and we&rsquo;ll refund the duplicate within 5
            business days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">How refunds are paid</h2>
          <p>
            Refunds are issued to the original payment method via Paystack and typically
            arrive within 5–10 business days, depending on your bank.
          </p>
        </section>

        <section>
          <p>
            Need help?{" "}
            <Link href="/account" className="text-primary hover:underline">
              Visit your account page
            </Link>{" "}
            or email{" "}
            <a href="mailto:support@puremix.ai" className="text-primary hover:underline">
              support@puremix.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
