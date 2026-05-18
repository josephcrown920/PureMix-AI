import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { processMasteringJob } from "../../lib/masteringProcessor";
import {
  GetMasteringJobParams,
  DeleteMasteringJobParams,
  GetInputFileParams,
  GetOutputFileParams,
} from "@workspace/api-zod";
import fs from "fs";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeEntitlement } from "../../lib/plans";
import { uploadLimiter } from "../../middlewares/rateLimit";
import { validateCustomParams } from "../../lib/masteringParams";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router: IRouter = Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "..", "uploads", "input");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(", ")}`));
  },
});

const VALID_PRESETS = ["streaming", "club", "warm_vinyl", "broadcast", "afrobeats", "hiphop", "trap", "custom"] as const;
const PRESET_LUFS: Record<string, number> = {
  streaming: -14,
  club: -7,
  warm_vinyl: -12,
  broadcast: -23,
  afrobeats: -9,
  hiphop: -8,
  trap: -8,
  custom: -14,
};

function jobToJson(j: typeof masteringJobsTable.$inferSelect) {
  return {
    id: j.id,
    filename: j.filename,
    originalFilename: j.originalFilename,
    preset: j.preset,
    status: j.status,
    progress: j.progress,
    targetLufs: j.targetLufs,
    measuredInputLufs: j.measuredInputLufs,
    measuredOutputLufs: j.measuredOutputLufs,
    errorMessage: j.errorMessage,
    downloadUnlocked: j.downloadUnlocked,
    unlockMode: j.unlockMode,
    customParams: j.customParams ?? null,
    // Strip server-side outputPath from variant payload — clients address
    // variants by id via /mastering/jobs/:id/files/output?variant=<id>.
    variants: j.variants
      ? j.variants.map((v: { id: string; label: string; description: string; outputLufs: number }) => ({
          id: v.id,
          label: v.label,
          description: v.description,
          outputLufs: v.outputLufs,
        }))
      : null,
    selectedVariantId: j.selectedVariantId,
    createdAt: j.createdAt.toISOString(),
    completedAt: j.completedAt?.toISOString() ?? null,
  };
}

// ALL mastering routes require auth
router.use("/mastering", requireAuth);

router.get("/mastering/jobs", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const jobs = await db
    .select()
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.userId, userId))
    .orderBy(desc(masteringJobsTable.createdAt));
  res.json(jobs.map(jobToJson));
});

router.post(
  "/mastering/jobs",
  uploadLimiter,
  upload.fields([{ name: "audio", maxCount: 1 }, { name: "reference", maxCount: 1 }]),
  async (req, res): Promise<void> => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const audioFile = files?.["audio"]?.[0];
    const referenceFile = files?.["reference"]?.[0];

    if (!audioFile) {
      if (referenceFile) try { fs.unlinkSync(referenceFile.path); } catch { /* ignore */ }
      res.status(400).json({ error: "No audio file uploaded" });
      return;
    }
    const userId = req.userId!;

    // Determine if this submission is allowed and how the download will be
    // unlocked. Trial users can submit (preview only); paid users get the
    // download unlocked + email after mastering completes.
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      try { fs.unlinkSync(audioFile.path); } catch { /* ignore */ }
      if (referenceFile) try { fs.unlinkSync(referenceFile.path); } catch { /* ignore */ }
      res.status(404).json({ error: "User not found" });
      return;
    }
    const ent = computeEntitlement(user);
    if (!ent.allowed) {
      try { fs.unlinkSync(audioFile.path); } catch { /* ignore */ }
      if (referenceFile) try { fs.unlinkSync(referenceFile.path); } catch { /* ignore */ }
      res.status(402).json({
        error: "No credits. $2 for one master, $10 for a 24-hour pass, or $200 lifetime.",
        code: "PLAN_LIMIT",
      });
      return;
    }

    // Reserve the entitlement BEFORE inserting the job so heavy concurrency
    // can't drain credits / trial twice.
    let downloadUnlocked = false;
    let unlockMode: string | null = null;
    if (ent.consumeMode === "lifetime") {
      downloadUnlocked = true;
      unlockMode = "lifetime";
    } else if (ent.consumeMode === "day") {
      downloadUnlocked = true;
      unlockMode = "day";
    } else if (ent.consumeMode === "credit") {
      // Decrement a credit (only if still > 0 — guards races)
      const result = await db
        .update(usersTable)
        .set({ credits: sql`${usersTable.credits} - 1`, updatedAt: new Date() })
        .where(and(eq(usersTable.id, userId), sql`${usersTable.credits} > 0`))
        .returning({ credits: usersTable.credits });
      if (result.length === 0) {
        try { fs.unlinkSync(audioFile.path); } catch { /* ignore */ }
        if (referenceFile) try { fs.unlinkSync(referenceFile.path); } catch { /* ignore */ }
        res.status(402).json({ error: "No credits remaining.", code: "PLAN_LIMIT" });
        return;
      }
      downloadUnlocked = true;
      unlockMode = "credit";
    }

    const preset = req.body.preset as string;
    if (!VALID_PRESETS.includes(preset as (typeof VALID_PRESETS)[number])) {
      res.status(400).json({ error: `Invalid preset. Must be one of: ${VALID_PRESETS.join(", ")}` });
      return;
    }

    let targetLufs: number | null = null;
    if (req.body.targetLufs != null && req.body.targetLufs !== "") {
      targetLufs = parseFloat(req.body.targetLufs);
      if (isNaN(targetLufs)) {
        res.status(400).json({ error: "Invalid targetLufs value" });
        return;
      }
    }
    const effectiveLufs = targetLufs ?? PRESET_LUFS[preset] ?? -14;

    // Optional Total Control overrides — JSON string in form body.
    let customParams: Record<string, number | boolean> | null = null;
    if (typeof req.body.customParams === "string" && req.body.customParams.trim()) {
      try {
        customParams = validateCustomParams(JSON.parse(req.body.customParams));
      } catch {
        res.status(400).json({ error: "Invalid customParams JSON" });
        return;
      }
    }

    // Empty array used as a "please render variations" flag for the worker.
    const generateVariations =
      req.body.generateVariations === "true" ||
      req.body.generateVariations === "1";

    const referencePath = referenceFile?.path ?? null;

    const [job] = await db
      .insert(masteringJobsTable)
      .values({
        userId,
        filename: audioFile.filename,
        originalFilename: audioFile.originalname,
        inputPath: audioFile.path,
        preset,
        status: "pending",
        progress: 0,
        targetLufs: effectiveLufs,
        downloadUnlocked,
        unlockMode,
        customParams,
        variants: generateVariations ? [] : null,
      })
      .returning();

    res.status(201).json(jobToJson(job));

    processMasteringJob(job.id, referencePath).catch((err: unknown) => {
      logger.error({ err, jobId: job.id }, "Background mastering job failed");
    });
  },
);

router.get("/mastering/jobs/:id", async (req, res): Promise<void> => {
  const params = GetMasteringJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.userId!;
  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Mastering job not found" });
    return;
  }
  res.json(jobToJson(job));
});

router.delete("/mastering/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteMasteringJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.userId!;
  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Mastering job not found" });
    return;
  }
  if (job.inputPath && fs.existsSync(job.inputPath)) fs.unlinkSync(job.inputPath);
  if (job.outputPath && fs.existsSync(job.outputPath)) fs.unlinkSync(job.outputPath);
  await db
    .delete(masteringJobsTable)
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)));
  res.sendStatus(204);
});

router.get("/mastering/stats", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [stats] = await db
    .select({
      totalJobs: sql<number>`count(*)::int`,
      completedJobs: sql<number>`count(*) filter (where status = 'completed')::int`,
      failedJobs: sql<number>`count(*) filter (where status = 'failed')::int`,
      processingJobs: sql<number>`count(*) filter (where status in ('pending', 'processing'))::int`,
      avgProcessingTimeMs: sql<number | null>`avg(extract(epoch from (completed_at - processing_started_at)) * 1000) filter (where status = 'completed' and processing_started_at is not null)`,
    })
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.userId, userId));
  res.json({
    totalJobs: stats.totalJobs ?? 0,
    completedJobs: stats.completedJobs ?? 0,
    failedJobs: stats.failedJobs ?? 0,
    processingJobs: stats.processingJobs ?? 0,
    avgProcessingTimeMs: stats.avgProcessingTimeMs ?? null,
  });
});

router.get("/mastering/files/:id/input", async (req, res): Promise<void> => {
  const params = GetInputFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.userId!;
  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)));
  if (!job || !job.inputPath || !fs.existsSync(job.inputPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const ext = path.extname(job.originalFilename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
  };
  res.setHeader("Content-Type", mimeTypes[ext] || "audio/mpeg");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(job.originalFilename)}"`);
  fs.createReadStream(job.inputPath).pipe(res);
});

router.get("/mastering/files/:id/output", async (req, res): Promise<void> => {
  const params = GetOutputFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.userId!;
  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Mastered file not ready" });
    return;
  }

  // If a variant is requested, serve that file instead of the primary output.
  // Variants live in their own folder under uploads/output/variants/job_<id>/.
  let filePath: string | null = job.outputPath;
  const variantId = typeof req.query.variant === "string" ? req.query.variant : null;
  if (variantId && job.variants) {
    const variant = job.variants.find((v: { id: string }) => v.id === variantId);
    if (!variant) {
      res.status(404).json({ error: `Unknown variant: ${variantId}` });
      return;
    }
    filePath = variant.outputPath;
  }

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: "Mastered file not ready" });
    return;
  }

  // Streaming for in-app preview is allowed for everyone (status 200, inline).
  // Downloads (Content-Disposition: attachment) require an unlocked job.
  const wantsDownload = req.query.download === "1";
  const variantSuffix = variantId ? `_${variantId}` : "";
  const masteredFilename = `mastered${variantSuffix}_${job.originalFilename.replace(/\.[^.]+$/, "")}.wav`;
  res.setHeader("Content-Type", "audio/wav");
  if (wantsDownload) {
    if (!job.downloadUnlocked) {
      res.status(402).json({
        error: "This master is preview-only. Pay $2 to unlock the download.",
        code: "DOWNLOAD_LOCKED",
        jobId: job.id,
      });
      return;
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(masteredFilename)}"`,
    );
  } else {
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(masteredFilename)}"`,
    );
  }
  fs.createReadStream(filePath).pipe(res);
});

/**
 * PUT /mastering/jobs/:id/variant — choose which AI variant becomes the
 * "primary" master (also drives downloads + email). Body: { variantId }
 */
router.put("/mastering/jobs/:id/variant", async (req, res): Promise<void> => {
  const params = GetMasteringJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const variantId = (req.body?.variantId ?? "").toString();
  if (!variantId) {
    res.status(400).json({ error: "variantId is required" });
    return;
  }

  const userId = req.userId!;
  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Mastering job not found" });
    return;
  }
  if (!job.variants || job.variants.length === 0) {
    res.status(400).json({ error: "This job has no variants to choose from" });
    return;
  }
  const variant = job.variants.find((v: { id: string }) => v.id === variantId);
  if (!variant) {
    res.status(400).json({ error: `Unknown variant: ${variantId}` });
    return;
  }

  // Mirror the chosen variant into the canonical outputPath so downloads &
  // email link continue to point at the same URL the rest of the app uses.
  try {
    if (variant.outputPath && fs.existsSync(variant.outputPath) && job.outputPath) {
      fs.copyFileSync(variant.outputPath, job.outputPath);
    }
  } catch (err) {
    logger.warn({ err, jobId: job.id, variantId }, "Failed to mirror variant to primary output");
  }

  const [updated] = await db
    .update(masteringJobsTable)
    .set({
      selectedVariantId: variantId,
      measuredOutputLufs: variant.outputLufs ?? job.measuredOutputLufs,
    })
    .where(and(eq(masteringJobsTable.id, params.data.id), eq(masteringJobsTable.userId, userId)))
    .returning();
  res.json(jobToJson(updated));
});

export default router;
