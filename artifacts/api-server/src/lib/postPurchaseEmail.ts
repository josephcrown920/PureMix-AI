import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { sendMasterReadyEmail } from "./email";
import { logger } from "./logger";

/**
 * Find any recently-completed-but-never-emailed jobs for this user that are
 * now download-unlocked, and fire off the master-ready emails.
 * Called from the webhook after a purchase grants a download right.
 *
 * Uses an atomic "claim" pattern: each job's `emailSentAt` is set to NOW() in
 * the SAME query that finds it, so two concurrent triggers (webhook + verify,
 * or webhook + processor) can never both send the same email. If the email
 * itself fails, we roll the timestamp back so a future retry can pick it up.
 */
export async function sendEmailsForRecentlyUnlockedJobs(
  userId: string,
): Promise<void> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user?.email) return;

  // Atomic claim: mark all eligible jobs as "sent" up-front and capture them
  // via RETURNING. Anyone else racing us will see emailSentAt IS NOT NULL.
  const claimedAt = new Date();
  const claimedJobs = await db
    .update(masteringJobsTable)
    .set({ emailSentAt: claimedAt })
    .where(
      and(
        eq(masteringJobsTable.userId, userId),
        eq(masteringJobsTable.status, "completed"),
        eq(masteringJobsTable.downloadUnlocked, true),
        isNull(masteringJobsTable.emailSentAt),
      ),
    )
    .returning();

  for (const job of claimedJobs) {
    const downloadUrl = buildDownloadUrl(job.id);
    const result = await sendMasterReadyEmail({
      to: user.email,
      filename: job.originalFilename,
      preset: job.preset,
      downloadUrl,
    });
    if (!result.delivered) {
      logger.warn(
        { jobId: job.id, reason: result.reason },
        "Failed to send post-purchase email; rolling back claim",
      );
      // Roll back so a future trigger (next purchase, manual retry) picks it
      // back up. Only roll back if our timestamp is still the one in the DB
      // (don't clobber a later successful send by another process).
      await db
        .update(masteringJobsTable)
        .set({ emailSentAt: null })
        .where(
          and(
            eq(masteringJobsTable.id, job.id),
            eq(masteringJobsTable.emailSentAt, claimedAt),
          ),
        );
    }
  }
}

export function buildDownloadUrl(jobId: number): string {
  const base = process.env.PUBLIC_APP_URL ?? "";
  // Frontend route that handles auth + triggers the download
  return `${base.replace(/\/$/, "")}/jobs/${jobId}?download=1`;
}
