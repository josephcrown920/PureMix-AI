import { Link } from "wouter";

export function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to home
        </Link>
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: May 8, 2026</p>

      <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By creating an account, uploading audio, or purchasing a credit on Puremix.ai
            (&ldquo;the Service&rdquo;), you agree to these Terms of Service. If you do not
            agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. The Service</h2>
          <p>
            Puremix.ai provides AI-assisted audio mastering. You upload an audio file, choose
            a preset or custom parameters, and we render a mastered version of your track. We
            do not claim ownership of any audio you upload or any output we produce.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. Your Content & Rights</h2>
          <p>
            You represent that you own or have all necessary rights to every audio file you
            upload. You grant us a limited license to process, store, and deliver back to you
            the audio you upload solely for the purpose of operating the Service. We do not
            sell your audio, train models on it, or share it with third parties except as
            required to provide the Service (e.g., file storage and email delivery).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
          <p>You agree not to use the Service to upload, process, or distribute:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Audio you do not have rights to</li>
            <li>Content that is illegal, harassing, or infringes any third-party rights</li>
            <li>Malware, exploits, or content meant to disrupt the Service</li>
          </ul>
          <p>We may suspend or terminate accounts that violate these rules.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Payments & Credits</h2>
          <p>
            Puremix.ai is paid. Pricing is shown on the{" "}
            <Link href="/pricing" className="text-primary hover:underline">
              pricing page
            </Link>{" "}
            and may change at any time. Single Master credits are consumed per mastered
            track. The 24-Hour Pass and Lifetime plan grant unlimited mastering for their
            stated period. All prices are in USD unless otherwise stated. Payments are
            processed by Paystack — we do not store your card details.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Refunds</h2>
          <p>
            See our{" "}
            <Link href="/refunds" className="text-primary hover:underline">
              Refund Policy
            </Link>
            . In short: if a master fails for technical reasons on our side, your credit is
            refunded automatically. Successful masters are non-refundable once delivered.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Service Availability</h2>
          <p>
            The Service is provided &ldquo;as is.&rdquo; We don&rsquo;t guarantee any specific
            uptime, processing time, or sonic outcome. Mastering is creative work and
            results vary with the source material.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Puremix.ai is not liable for any indirect,
            incidental, or consequential damages arising from your use of the Service. Our
            total liability for any claim is limited to the amount you paid us in the 30 days
            before the claim arose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">9. Changes</h2>
          <p>
            We may update these terms. Material changes will be communicated via email or an
            in-app notice. Continued use after a change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">10. Contact</h2>
          <p>
            Questions about these terms? Email{" "}
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
