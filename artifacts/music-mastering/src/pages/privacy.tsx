import { Link } from "wouter";

export function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to home
        </Link>
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: May 8, 2026</p>

      <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">What we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Account info</strong> — email address and authentication identifiers,
              provided by Clerk when you sign up.
            </li>
            <li>
              <strong>Audio you upload</strong> — your source files and the masters we render
              from them, stored on our servers so you can download them.
            </li>
            <li>
              <strong>Job metadata</strong> — preset chosen, loudness measurements, custom
              parameter settings, AI suggestion prompts.
            </li>
            <li>
              <strong>Payment metadata</strong> — Paystack transaction reference, plan
              purchased, amount, currency. We do <em>not</em> see or store your card details.
            </li>
            <li>
              <strong>Operational logs</strong> — IP address, user agent, timestamps. Used
              for debugging, abuse prevention, and rate limiting.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">How we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To run the mastering pipeline and deliver your output</li>
            <li>To track credits, plan status, and download entitlements</li>
            <li>To send transactional email (e.g. download-ready notifications) via Resend</li>
            <li>To answer support requests</li>
            <li>To prevent abuse (rate limiting, fraud detection)</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your data, share it with advertisers, or train
            machine-learning models on your audio.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Third-party processors</h2>
          <p>To run the Service we share necessary data with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Clerk</strong> — authentication & user management</li>
            <li><strong>Paystack</strong> — payment processing</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
            <li><strong>Anthropic</strong> — when you use the AI Suggestion feature, your text
              prompt (not your audio) is sent to Anthropic&rsquo;s API to generate the
              recommendation</li>
            <li><strong>Replit</strong> — hosting infrastructure</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Retention</h2>
          <p>
            Audio files (input and output) are retained as long as your account is active so
            you can re-download them. You may delete a job from your{" "}
            <Link href="/history" className="text-primary hover:underline">
              History
            </Link>
            , which removes the audio from our storage. Account, billing, and log data are
            retained for as long as legally required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Your rights</h2>
          <p>
            You can access, correct, export, or delete your account data at any time by
            emailing{" "}
            <a href="mailto:support@puremix.ai" className="text-primary hover:underline">
              support@puremix.ai
            </a>
            . If you&rsquo;re in the EU, UK, or California you also have rights under GDPR /
            CCPA which we honor on request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Cookies</h2>
          <p>
            We use only essential cookies — to keep you signed in (Clerk session) and to
            remember your preferences. We don&rsquo;t use ad-tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p>
            Privacy questions? Email{" "}
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
