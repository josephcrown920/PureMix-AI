import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email"),
  plan: text("plan").notNull().default("free"), // 'free' | 'pro' | 'lifetime'
  lifetime: boolean("lifetime").notNull().default(false),
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  paystackEmailToken: text("paystack_email_token"),
  proRenewsAt: timestamp("pro_renews_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
