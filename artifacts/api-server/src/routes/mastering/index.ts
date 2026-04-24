import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
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
import { getJobLimit, PLANS } from "../../lib/plans";

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

const VALID_PRESETS = ["streaming", "club", "warm_vinyl", "broadcast", "custom"] as const;
const PRESET_LUFS: Record<string, number> = {
  streaming: -14,
  club: -7,
  warm_vinyl: -12,
  broadcast: -23,
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
  upload.single("audio"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No audio file uploaded" });
      return;
    }
    const userId = req.userId!;

    // Enforce monthly job limit based on user's plan.
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const plan = (user?.plan ?? "free") as keyof typeof PLANS;
    const limit = getJobLimit(plan);
    if (limit != null) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(masteringJobsTable)
        .where(
          and(
            eq(masteringJobsTable.userId, userId),
            gte(masteringJobsTable.createdAt, monthStart),
          ),
        );
      if ((count ?? 0) >= limit) {
        // Clean up uploaded file
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        res.status(402).json({
          error: `Monthly limit reached (${limit} jobs on ${plan} plan). Upgrade for unlimited masters.`,
          code: "PLAN_LIMIT",
          plan,
          limit,
        });
        return;
      }
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

    const [job] = await db
      .insert(masteringJobsTable)
      .values({
        userId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        inputPath: req.file.path,
        preset,
        status: "pending",
        progress: 0,
        targetLufs: effectiveLufs,
      })
      .returning();

    res.status(201).json(jobToJson(job));

    processMasteringJob(job.id).catch((err: unknown) => {
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
  if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
    res.status(404).json({ error: "Mastered file not ready" });
    return;
  }
  const masteredFilename = `mastered_${job.originalFilename.replace(/\.[^.]+$/, "")}.wav`;
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(masteredFilename)}"`);
  fs.createReadStream(job.outputPath).pipe(res);
});

export default router;
