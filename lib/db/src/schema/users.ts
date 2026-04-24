import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email"),
  // `plan` is a denormalized label of the user's current highest entitlement
  // tier: 'trial' | 'payg' | 'day' | 'lifetime'. The source of truth lives in
  // `lifetime`, `dayPassExpiresAt`, `credits`, and `freeTrialUsed`.
  plan: text("plan").notNull().default("trial"),
  lifetime: boolean("lifetime").notNull().default(false),
  // Pay-as-you-go credits (1 credit = 1 master)
  credits: integer("credits").notNull().default(0),
  // 24-hour unlimited window. If set and in the future, unlimited masters.
  dayPassExpiresAt: timestamp("day_pass_expires_at", { withTimezone: true }),
  // Single lifetime free-trial master.
  freeTrialUsed: boolean("free_trial_used").notNull().default(false),
  // Paystack identifiers (only customer code is used now; no recurring subs).
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  paystackEmailToken: text("paystack_email_token"),
  proRenewsAt: timestamp("pro_renews_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
