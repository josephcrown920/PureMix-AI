import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
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

interface VariantMeta {
  id: string;
  label: string;
  description: string;
  outputPath: string;
  outputLufs: number;
}

interface AudioAnalysis {
  integrated_lufs: number;
  loudness_range: number;
  true_peak_dbfs: number;
  rms_db: number;
  crest_factor_db: number;
  spectral_centroid_hz: number;
  low_energy_ratio: number;
  mid_energy_ratio: number;
  high_energy_ratio: number;
  stereo_width: number;
  duration_sec: number;
  sample_rate: number;
}

/**
 * Run the audio analysis script on an input file.
 * Returns null if analysis fails — mastering can still proceed without it,
 * just with non-adaptive parameters.
 */
async function runAudioAnalysis(inputPath: string): Promise<AudioAnalysis | null> {
  const scriptPath = path.join(__dirname, "audioAnalysis.py");
  return new Promise((resolve) => {
    const proc = spawn("python3", [scriptPath, inputPath]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        logger.warn({ stderr, code }, "Audio analysis script failed — proceeding without analysis");
        resolve(null);
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as AudioAnalysis & { error?: string };
        if (result.error) {
          logger.warn({ error: result.error }, "Audio analysis returned error");
          resolve(null);
        } else {
          resolve(result);
        }
      } catch (e) {
        logger.warn({ e, stdout }, "Could not parse audio analysis output");
        resolve(null);
      }
    });

    proc.on("error", (err) => {
      logger.warn({ err }, "Failed to spawn audio analysis script");
      resolve(null);
    });
  });
}

export async function processMasteringJob(jobId: number, referencePath: string | null = null): Promise<void> {
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

    // --- Phase 1: Audio analysis (fast ~2-3s) ---
    // Run before mastering so we have real measurements to adapt the DSP chain.
    // If analysis fails, mastering still proceeds with preset defaults.
    logger.info({ jobId }, "Running audio analysis");
    const analysis = await runAudioAnalysis(job.inputPath);

    if (analysis) {
      logger.info({ jobId, analysis }, "Audio analysis complete");
      await db
        .update(masteringJobsTable)
        .set({ audioAnalysis: analysis, progress: 12 })
        .where(eq(masteringJobsTable.id, jobId));
    } else {
      logger.warn({ jobId }, "Audio analysis unavailable — using preset defaults");
    }

    // --- Phase 2: Mastering ---
    const baseName = job.filename.replace(/\.[^.]+$/, "");
    const outputFilename = `mastered_${baseName}.wav`;
    const outputDir = path.join(__dirname, "..", "..", "uploads", "output");
    const outputPath = path.join(outputDir, outputFilename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const scriptPath = path.join(__dirname, "audioMastering.py");

    const wantsVariations = Array.isArray(job.variants);
    const variantsDir = wantsVariations
      ? path.join(outputDir, "variants", `job_${job.id}`)
      : null;
    if (variantsDir && !fs.existsSync(variantsDir)) {
      fs.mkdirSync(variantsDir, { recursive: true });
    }

    const args = [
      job.inputPath,
      outputPath,
      job.preset,
      String(targetLufs),
    ];
    if (job.customParams && Object.keys(job.customParams).length > 0) {
      args.push("--params", JSON.stringify(job.customParams));
    }
    if (analysis) {
      args.push("--analysis", JSON.stringify(analysis));
    }
    if (variantsDir) {
      args.push("--variations", variantsDir);
    }
    if (referencePath && fs.existsSync(referencePath)) {
      args.push("--reference", referencePath);
    }

    const minWait = new Promise<void>((resolve) =>
      setTimeout(resolve, MIN_PROCESSING_MS)
    );

    const [result] = await Promise.all([
      runPythonScript(scriptPath, args, jobId),
      minWait,
    ]);

    const elapsed = Date.now() - processingStart;

    if (wantsVariations && (!result.variants || result.variants.length === 0)) {
      throw new Error(
        "AI variations were requested but the engine did not return a complete variants manifest. The job has been marked failed; please retry.",
      );
    }
    if (result.variants) {
      for (const v of result.variants) {
        if (!v.outputPath || !fs.existsSync(v.outputPath)) {
          throw new Error(
            `Variant '${v.id}' missing output file on disk; refusing to commit job as completed.`,
          );
        }
      }
    }

    logger.info({ jobId, elapsedMs: elapsed }, "Mastering completed");

    await db
      .update(masteringJobsTable)
      .set({
        status: "completed",
        progress: 100,
        outputPath,
        measuredInputLufs: result.input_lufs ?? null,
        measuredOutputLufs: result.output_lufs ?? null,
        variants: result.variants ?? job.variants ?? null,
        selectedVariantId: result.variants && !job.selectedVariantId
          ? "ai_pick"
          : job.selectedVariantId,
        completedAt: new Date(),
      })
      .where(eq(masteringJobsTable.id, jobId));

    logger.info({ jobId, outputPath }, "Mastering job completed");

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

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(masteringJobsTable)
        .set({
          status: "failed",
          errorMessage,
          completedAt: new Date(),
          downloadUnlocked: false,
        })
        .where(
          and(
            eq(masteringJobsTable.id, jobId),
            sql`${masteringJobsTable.status} <> 'failed'`,
          ),
        )
        .returning({ id: masteringJobsTable.id });

      if (updated.length === 0) {
        logger.warn({ jobId }, "Job already marked failed; skipping refund");
        return;
      }

      if (job.unlockMode === "credit" && job.userId) {
        await tx
          .update(usersTable)
          .set({
            credits: sql`${usersTable.credits} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, job.userId));
        logger.info({ jobId, userId: job.userId }, "Refunded 1 credit due to failed job");
      }
    });
  }
}

interface PythonResult {
  input_lufs?: number;
  output_lufs?: number;
  variants?: VariantMeta[];
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
    let stdoutBuf = "";

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.type === "progress") {
          const progress = Math.min(95, msg.progress as number);
          db.update(masteringJobsTable)
            .set({ progress })
            .where(eq(masteringJobsTable.id, jobId))
            .catch((e: unknown) => logger.warn({ e }, "Failed to update progress"));
        } else if (msg.type === "result") {
          result = {
            input_lufs: msg.input_lufs,
            output_lufs: msg.output_lufs,
            variants: msg.variants,
          };
        } else if (msg.type === "error") {
          errorOutput = msg.error as string;
        }
      } catch {
        // Non-JSON line, ignore
      }
    };

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      let newlineIdx = stdoutBuf.indexOf("\n");
      while (newlineIdx !== -1) {
        const line = stdoutBuf.slice(0, newlineIdx);
        stdoutBuf = stdoutBuf.slice(newlineIdx + 1);
        handleLine(line);
        newlineIdx = stdoutBuf.indexOf("\n");
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    proc.on("close", (code) => {
      if (stdoutBuf.length > 0) handleLine(stdoutBuf);
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
