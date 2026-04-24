import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { sendMasterReadyEmail } from "./email";
import { logger } from "./logger";

/**
 * Find any recently-completed-but-never-emailed jobs for this user that are
 * now download-unlocked, and fire off the master-ready emails.
 * Called from the webhook after a purchase grants a download right.
 */
export async function sendEmailsForRecentlyUnlockedJobs(
  userId: string,
): Promise<void> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user?.email) return;

  const jobs = await db
    .select()
    .from(masteringJobsTable)
    .where(
      and(
        eq(masteringJobsTable.userId, userId),
        eq(masteringJobsTable.status, "completed"),
        eq(masteringJobsTable.downloadUnlocked, true),
        isNull(masteringJobsTable.emailSentAt),
      ),
    );

  for (const job of jobs) {
    const downloadUrl = buildDownloadUrl(job.id);
    const result = await sendMasterReadyEmail({
      to: user.email,
      filename: job.originalFilename,
      preset: job.preset,
      downloadUrl,
    });
    if (result.delivered) {
      await db
        .update(masteringJobsTable)
        .set({ emailSentAt: new Date() })
        .where(eq(masteringJobsTable.id, job.id));
    } else {
      logger.warn(
        { jobId: job.id, reason: result.reason },
        "Failed to send post-purchase email",
      );
    }
  }
}

export function buildDownloadUrl(jobId: number): string {
  const base = process.env.PUBLIC_APP_URL ?? "";
  // Frontend route that handles auth + triggers the download
  return `${base.replace(/\/$/, "")}/jobs/${jobId}?download=1`;
}
