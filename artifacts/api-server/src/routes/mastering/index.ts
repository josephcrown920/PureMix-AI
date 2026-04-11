import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { db, masteringJobsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { processMasteringJob } from "../../lib/masteringProcessor";
import {
  GetMasteringJobParams,
  DeleteMasteringJobParams,
  GetInputFileParams,
  GetOutputFileParams,
} from "@workspace/api-zod";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router: IRouter = Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "..", "uploads", "input");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(", ")}`));
    }
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

// GET /mastering/jobs
router.get("/mastering/jobs", async (req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(masteringJobsTable)
    .orderBy(desc(masteringJobsTable.createdAt));

  res.json(
    jobs.map((j) => ({
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
    }))
  );
});

// POST /mastering/jobs
router.post(
  "/mastering/jobs",
  upload.single("audio"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No audio file uploaded" });
      return;
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
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        inputPath: req.file.path,
        preset,
        status: "pending",
        progress: 0,
        targetLufs: effectiveLufs,
      })
      .returning();

    res.status(201).json({
      id: job.id,
      filename: job.filename,
      originalFilename: job.originalFilename,
      preset: job.preset,
      status: job.status,
      progress: job.progress,
      targetLufs: job.targetLufs,
      measuredInputLufs: job.measuredInputLufs,
      measuredOutputLufs: job.measuredOutputLufs,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      completedAt: null,
    });

    // Start processing in the background (non-blocking)
    processMasteringJob(job.id).catch((err: unknown) => {
      logger.error({ err, jobId: job.id }, "Background mastering job failed");
    });
  }
);

// GET /mastering/jobs/:id
router.get("/mastering/jobs/:id", async (req, res): Promise<void> => {
  const params = GetMasteringJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.id, params.data.id));

  if (!job) {
    res.status(404).json({ error: "Mastering job not found" });
    return;
  }

  res.json({
    id: job.id,
    filename: job.filename,
    originalFilename: job.originalFilename,
    preset: job.preset,
    status: job.status,
    progress: job.progress,
    targetLufs: job.targetLufs,
    measuredInputLufs: job.measuredInputLufs,
    measuredOutputLufs: job.measuredOutputLufs,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  });
});

// DELETE /mastering/jobs/:id
router.delete("/mastering/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteMasteringJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.id, params.data.id));

  if (!job) {
    res.status(404).json({ error: "Mastering job not found" });
    return;
  }

  // Clean up files
  if (job.inputPath && fs.existsSync(job.inputPath)) {
    fs.unlinkSync(job.inputPath);
  }
  if (job.outputPath && fs.existsSync(job.outputPath)) {
    fs.unlinkSync(job.outputPath);
  }

  await db.delete(masteringJobsTable).where(eq(masteringJobsTable.id, params.data.id));

  res.sendStatus(204);
});

// GET /mastering/stats
router.get("/mastering/stats", async (_req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalJobs: sql<number>`count(*)::int`,
      completedJobs: sql<number>`count(*) filter (where status = 'completed')::int`,
      failedJobs: sql<number>`count(*) filter (where status = 'failed')::int`,
      processingJobs: sql<number>`count(*) filter (where status in ('pending', 'processing'))::int`,
      avgProcessingTimeMs: sql<number | null>`avg(extract(epoch from (completed_at - processing_started_at)) * 1000) filter (where status = 'completed' and processing_started_at is not null)`,
    })
    .from(masteringJobsTable);

  res.json({
    totalJobs: stats.totalJobs ?? 0,
    completedJobs: stats.completedJobs ?? 0,
    failedJobs: stats.failedJobs ?? 0,
    processingJobs: stats.processingJobs ?? 0,
    avgProcessingTimeMs: stats.avgProcessingTimeMs ?? null,
  });
});

// GET /mastering/files/:id/input
router.get("/mastering/files/:id/input", async (req, res): Promise<void> => {
  const params = GetInputFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.id, params.data.id));

  if (!job || !job.inputPath) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (!fs.existsSync(job.inputPath)) {
    res.status(404).json({ error: "File not found on disk" });
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

  const contentType = mimeTypes[ext] || "audio/mpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(job.originalFilename)}"`
  );

  const stream = fs.createReadStream(job.inputPath);
  stream.pipe(res);
});

// GET /mastering/files/:id/output
router.get("/mastering/files/:id/output", async (req, res): Promise<void> => {
  const params = GetOutputFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.id, params.data.id));

  if (!job || !job.outputPath) {
    res.status(404).json({ error: "Mastered file not ready" });
    return;
  }

  if (!fs.existsSync(job.outputPath)) {
    res.status(404).json({ error: "Mastered file not found on disk" });
    return;
  }

  const masteredFilename = `mastered_${job.originalFilename.replace(/\.[^.]+$/, "")}.wav`;

  res.setHeader("Content-Type", "audio/wav");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(masteredFilename)}"`
  );

  const stream = fs.createReadStream(job.outputPath);
  stream.pipe(res);
});

export default router;
