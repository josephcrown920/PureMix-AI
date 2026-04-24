import { Resend } from "resend";
import { logger } from "./logger";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress =
  process.env.RESEND_FROM_EMAIL ?? "Puremix.ai <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export interface MasterReadyEmailParams {
  to: string;
  filename: string;
  downloadUrl: string;
  preset: string;
}

export async function sendMasterReadyEmail(
  params: MasterReadyEmailParams,
): Promise<{ delivered: boolean; reason?: string }> {
  if (!resend) {
    logger.warn(
      { to: params.to },
      "RESEND_API_KEY not set; skipping master-ready email",
    );
    return { delivered: false, reason: "email-not-configured" };
  }

  const { to, filename, downloadUrl, preset } = params;
  const subject = `Your master is ready — ${filename}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a1929; color: #e2e8f0; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: #0f1f33; border-radius: 12px; padding: 32px; border: 1px solid rgba(56, 189, 248, 0.2);">
        <h1 style="color: #38bdf8; margin: 0 0 8px; font-size: 24px;">Puremix.ai</h1>
        <p style="color: #94a3b8; margin: 0 0 24px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Master complete</p>
        <h2 style="color: #f1f5f9; margin: 0 0 16px; font-size: 20px;">Your track is ready</h2>
        <p style="color: #cbd5e1; line-height: 1.6;">
          We just finished mastering <strong style="color: #f1f5f9;">${escapeHtml(filename)}</strong>
          using the <strong style="color: #38bdf8;">${escapeHtml(preset)}</strong> preset.
          Click below to download the high-resolution WAV.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #38bdf8, #0ea5e9); color: #0a1929; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
            Download master
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 32px;">
          This download link is tied to your account — sign in if prompted.
          Built for Afrobeats, hip-hop, and trap.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });
    if (result.error) {
      logger.error({ err: result.error, to }, "Resend send failed");
      return { delivered: false, reason: result.error.message };
    }
    logger.info({ to, id: result.data?.id }, "Master-ready email sent");
    return { delivered: true };
  } catch (err) {
    logger.error({ err, to }, "Resend exception");
    return {
      delivered: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
