import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
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
