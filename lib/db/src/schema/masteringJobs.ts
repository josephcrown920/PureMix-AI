import { pgTable, text, serial, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masteringJobsTable = pgTable("mastering_jobs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  userId: text("user_id"),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  inputPath: text("input_path").notNull(),
  outputPath: text("output_path"),
  preset: text("preset").notNull(),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  targetLufs: real("target_lufs"),
  measuredInputLufs: real("measured_input_lufs"),
  measuredOutputLufs: real("measured_output_lufs"),
  errorMessage: text("error_message"),
  // Whether the user has paid for / is entitled to download this master.
  downloadUnlocked: boolean("download_unlocked").notNull().default(false),
  // How the download right was granted: 'lifetime' | 'day' | 'credit' (consumed) | null
  unlockMode: text("unlock_mode"),
  // User-provided DSP parameter overrides (Total Control mode). Sparse object;
  // unspecified knobs use preset defaults. Structure validated server-side.
  customParams: jsonb("custom_params").$type<Record<string, number | boolean>>(),
  // When the job was rendered with AI variations, this stores the variant
  // metadata: [{ id, label, description, outputPath, outputLufs }]. The
  // primary output (job.outputPath) mirrors the user-selected variant or
  // 'ai_pick' if none chosen yet.
  variants: jsonb("variants").$type<Array<{
    id: string;
    label: string;
    description: string;
    outputPath: string;
    outputLufs: number;
  }>>(),
  selectedVariantId: text("selected_variant_id"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
});

export const insertMasteringJobSchema = createInsertSchema(masteringJobsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  processingStartedAt: true,
});

export type InsertMasteringJob = z.infer<typeof insertMasteringJobSchema>;
export type MasteringJob = typeof masteringJobsTable.$inferSelect;
