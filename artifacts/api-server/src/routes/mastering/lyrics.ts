import { Router, type IRouter } from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/requireAuth";
import { lyricsLimiter } from "../../middlewares/rateLimit";

const router: IRouter = Router();

const MAX_BYTES = 24 * 1024 * 1024;

function getClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  // The Replit AI proxy expects paths WITHOUT a /v1 prefix (e.g. /audio/transcriptions).
  // The OpenAI SDK automatically appends /v1 to the baseURL, so we must NOT include
  // it in the base URL — the proxy root IS the versioned base.
  const normalizedBase = baseURL.replace(/\/v1\/?$/, "");
  return new OpenAI({ baseURL: normalizedBase, apiKey });
}

/**
 * POST /api/mastering/jobs/:id/lyrics
 *
 * Transcribes the input audio of a completed mastering job using OpenAI
 * Whisper. Free for any user who already paid for that job (credit, day-pass,
 * or lifetime) — lyrics is a bonus on top of the master they bought.
 *
 * File-size cap: OpenAI's transcription endpoint accepts up to 25 MB. Larger
 * files return a 413 with a clear message to bounce a shorter export.
 */
router.post(
  "/mastering/jobs/:id/lyrics",
  requireAuth,
  lyricsLimiter,
  async (req, res): Promise<void> => {
    const userId = req.userId!;
    const jobId = parseInt(String(req.params.id ?? ""), 10);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      res.status(400).json({ error: "Invalid job id." });
      return;
    }

    const [job] = await db
      .select()
      .from(masteringJobsTable)
      .where(and(eq(masteringJobsTable.id, jobId), eq(masteringJobsTable.userId, userId)))
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    if (job.status !== "completed") {
      res.status(409).json({ error: "Wait for mastering to complete before transcribing." });
      return;
    }

    // Entitlement: must have a paid relationship with this job. Either it was
    // already unlocked (download paid for) OR they currently have a day-pass /
    // lifetime / credit.
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!me) {
      res.status(401).json({ error: "User not found." });
      return;
    }
    const now = new Date();
    const dayPassActive = !!(me.dayPassExpiresAt && new Date(me.dayPassExpiresAt) > now);
    const entitled =
      job.downloadUnlocked === true ||
      me.lifetime === true ||
      dayPassActive ||
      (typeof me.credits === "number" && me.credits > 0);
    if (!entitled) {
      res.status(402).json({
        error:
          "Lyrics transcription is included with any paid master. Buy a single ($2), day-pass ($10), or lifetime ($200) plan first.",
        code: "PLAN_LIMIT",
      });
      return;
    }

    if (!job.inputPath || !fs.existsSync(job.inputPath)) {
      res.status(410).json({ error: "Source audio is no longer available." });
      return;
    }

    const stat = fs.statSync(job.inputPath);
    if (stat.size > MAX_BYTES) {
      res.status(413).json({
        error: `File is ${(stat.size / 1024 / 1024).toFixed(1)}MB. Lyrics transcription supports up to 24MB — re-export a smaller mixdown.`,
      });
      return;
    }

    const client = getClient();
    if (!client) {
      res.status(503).json({ error: "Lyrics service is temporarily unavailable." });
      return;
    }

    let stream: fs.ReadStream | null = null;
    try {
      stream = fs.createReadStream(job.inputPath);
      // OpenAI SDK reads filename hints from the stream's `path` for content
      // sniffing. Pass the original path so the API gets the correct ext.
      Object.defineProperty(stream, "path", {
        value: path.basename(job.inputPath),
        configurable: true,
      });

      const t = await client.audio.transcriptions.create({
        file: stream,
        model: "gpt-4o-mini-transcribe",
        response_format: "json",
      });

      const text = typeof t.text === "string" ? t.text.trim() : "";
      res.json({ text, language: null });
    } catch (err) {
      logger.error({ err, jobId }, "Lyrics transcription failed");
      const status = (err as { status?: number })?.status;
      if (status === 413) {
        res.status(413).json({ error: "File too large for transcription." });
        return;
      }
      res.status(502).json({
        error: "Transcription service is unreachable. Try again in a moment.",
      });
    } finally {
      // Defensive: if OpenAI threw before fully draining the stream, close the
      // file descriptor explicitly to avoid EMFILE under load.
      if (stream && !stream.destroyed) {
        stream.destroy();
      }
    }
  },
);

export { router as lyricsRouter };
