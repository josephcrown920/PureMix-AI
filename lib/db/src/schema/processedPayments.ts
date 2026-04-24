import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Idempotency log for Paystack purchases. The /billing/verify endpoint and the
// webhook can both fire for the same transaction; inserting the reference here
// inside applyPurchase guarantees the credit/unlock side-effects run exactly
// once per Paystack reference.
export const processedPaymentsTable = pgTable("processed_payments", {
  reference: text("reference").primaryKey(),
  userId: text("user_id").notNull(),
  internalPlan: text("internal_plan").notNull(),
  amountCents: text("amount_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
