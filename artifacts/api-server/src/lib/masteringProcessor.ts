import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, masteringJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRESET_LUFS: Record<string, number> = {
  streaming: -14,
  club: -7,
  warm_vinyl: -12,
  broadcast: -23,
  custom: -14,
};

export async function processMasteringJob(jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.id, jobId));

  if (!job) {
    logger.error({ jobId }, "Job not found for processing");
    return;
  }

  const targetLufs = job.targetLufs ?? PRESET_LUFS[job.preset] ?? -14;

  // Enforce a minimum processing time so the progress animation feels real
  const MIN_PROCESSING_MS = 30_000;

  try {
    const processingStart = Date.now();

    await db
      .update(masteringJobsTable)
      .set({ status: "processing", progress: 5, processingStartedAt: new Date() })
      .where(eq(masteringJobsTable.id, jobId));

    const baseName = job.filename.replace(/\.[^.]+$/, "");
    const outputFilename = `mastered_${baseName}.wav`;
    const outputDir = path.join(__dirname, "..", "..", "uploads", "output");
    const outputPath = path.join(outputDir, outputFilename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const scriptPath = path.join(__dirname, "audioMastering.py");

    const minWait = new Promise<void>((resolve) =>
      setTimeout(resolve, MIN_PROCESSING_MS)
    );

    const [result] = await Promise.all([
      runPythonScript(scriptPath, [
        job.inputPath,
        outputPath,
        job.preset,
        String(targetLufs),
      ], jobId),
      minWait,
    ]);

    const elapsed = Date.now() - processingStart;
    logger.info({ jobId, elapsedMs: elapsed }, "Mastering completed");

    await db
      .update(masteringJobsTable)
      .set({
        status: "completed",
        progress: 100,
        outputPath,
        measuredInputLufs: result.input_lufs ?? null,
        measuredOutputLufs: result.output_lufs ?? null,
        completedAt: new Date(),
      })
      .where(eq(masteringJobsTable.id, jobId));

    logger.info({ jobId, outputPath }, "Mastering job completed");

    // Fire-and-forget email if this job already has download access.
    try {
      const { sendEmailsForRecentlyUnlockedJobs } = await import(
        "./postPurchaseEmail"
      );
      if (job.userId) {
        await sendEmailsForRecentlyUnlockedJobs(job.userId);
      }
    } catch (err) {
      logger.error({ err, jobId }, "post-mastering email send failed");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ jobId, err }, "Mastering job failed");

    await db
      .update(masteringJobsTable)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(masteringJobsTable.id, jobId));
  }
}

interface PythonResult {
  input_lufs?: number;
  output_lufs?: number;
}

function runPythonScript(
  scriptPath: string,
  args: string[],
  jobId: number
): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [scriptPath, ...args]);
    let result: PythonResult = {};
    let errorOutput = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "progress") {
            const progress = Math.min(95, msg.progress as number);
            db.update(masteringJobsTable)
              .set({ progress })
              .where(eq(masteringJobsTable.id, jobId))
              .catch((e: unknown) => logger.warn({ e }, "Failed to update progress"));
          } else if (msg.type === "result") {
            result = { input_lufs: msg.input_lufs, output_lufs: msg.output_lufs };
          } else if (msg.type === "error") {
            errorOutput = msg.error as string;
          }
        } catch {
          // Non-JSON line, ignore
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(errorOutput || `Python process exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
