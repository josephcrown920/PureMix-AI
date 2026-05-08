import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, masteringJobsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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

    // Variations are triggered by the presence of any variants array (the
    // upload route inserts an empty array as a flag). We render into a
    // dedicated per-job folder so multiple jobs never collide.
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
    if (variantsDir) {
      args.push("--variations", variantsDir);
    }

    const minWait = new Promise<void>((resolve) =>
      setTimeout(resolve, MIN_PROCESSING_MS)
    );

    const [result] = await Promise.all([
      runPythonScript(scriptPath, args, jobId),
      minWait,
    ]);

    const elapsed = Date.now() - processingStart;

    // Crash-safety guard: if the user requested variations but the Python
    // process didn't return a non-empty `variants` array, treat the job as
    // failed rather than silently writing an inconsistent "completed" row.
    // This catches the case where the process exits cleanly mid-render or
    // the result payload was lost.
    if (wantsVariations && (!result.variants || result.variants.length === 0)) {
      throw new Error(
        "AI variations were requested but the engine did not return a complete variants manifest. The job has been marked failed; please retry.",
      );
    }
    // Sanity-check that all variant files exist on disk before committing.
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
        // Default selected variant to ai_pick when variations were generated
        // and the user hasn't picked one yet.
        selectedVariantId: result.variants && !job.selectedVariantId
          ? "ai_pick"
          : job.selectedVariantId,
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

    // Mark failed AND, if the failure is on our side, refund the credit that
    // was reserved when the job was submitted. Day-pass / lifetime users have
    // nothing to refund; only "credit" consumers do.
    await db.transaction(async (tx) => {
      await tx
        .update(masteringJobsTable)
        .set({
          status: "failed",
          errorMessage,
          completedAt: new Date(),
          // Revoke download entitlement so the failed row can't be downloaded.
          downloadUnlocked: false,
        })
        .where(eq(masteringJobsTable.id, jobId));

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
    // Buffer incomplete lines across chunks — without this, a JSON message
    // split across two stdout writes (likely with the larger result payload
    // containing variant metadata) would be silently dropped.
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
      // Flush any trailing line that didn't end in \n.
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
