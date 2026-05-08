import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  masteringJobsTable,
  processedPaymentsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { PLANS, CURRENCY, type PlanId } from "../lib/plans";
import { initializeTransaction, verifyTransaction } from "../lib/paystack";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/billing/plans", (_req, res): void => {
  res.json({
    currency: CURRENCY,
    plans: Object.values(PLANS),
  });
});

// POST /billing/checkout  body: { plan: 'single' | 'day' | 'lifetime', returnUrl, jobId? }
// jobId is optional — when present, that specific locked job will be unlocked
// after a successful 'single' purchase (instead of just adding a credit).
router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  const { plan, returnUrl, jobId } = req.body ?? {};
  if (plan !== "single" && plan !== "day" && plan !== "lifetime") {
    res.status(400).json({ error: "plan must be 'single', 'day' or 'lifetime'" });
    return;
  }
  if (!returnUrl || typeof returnUrl !== "string") {
    res.status(400).json({ error: "returnUrl is required" });
    return;
  }

  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const email = user?.email ?? req.userEmail;
  if (!email) {
    res.status(400).json({
      error: "No email on file. Please add an email to your account first.",
    });
    return;
  }

  const cfg = PLANS[plan as PlanId];

  try {
    const result = await initializeTransaction({
      email,
      amountCents: cfg.priceCents,
      currency: cfg.currency,
      callbackUrl: returnUrl,
      // No `plan` field — every purchase is a one-time charge now.
      metadata: {
        userId,
        internalPlan: plan,
        jobId: jobId != null ? Number(jobId) : undefined,
      },
    });

    res.json({
      authorizationUrl: result.authorization_url,
      reference: result.reference,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Checkout init failed");
    res.status(500).json({ error: err?.message ?? "Checkout failed" });
  }
});

// GET /billing/verify?reference=xxx — called after user returns from Paystack.
router.get("/billing/verify", requireAuth, async (req, res): Promise<void> => {
  const reference = String(req.query.reference ?? "");
  if (!reference) {
    res.status(400).json({ error: "reference required" });
    return;
  }
  try {
    const data = await verifyTransaction(reference);
    if (data.status !== "success") {
      res.json({ status: data.status, success: false });
      return;
    }

    const metadataUserId = (data.metadata as any)?.userId as string | undefined;
    const internalPlan = (data.metadata as any)?.internalPlan as
      | PlanId
      | undefined;
    const jobId = (data.metadata as any)?.jobId as number | undefined;

    // Authorization: the verified transaction must belong to the caller.
    // Without this check, any authenticated user could replay another user's
    // reference and mutate their account state.
    if (metadataUserId && metadataUserId !== req.userId) {
      logger.warn(
        { reference, callerId: req.userId, txnUserId: metadataUserId },
        "Cross-account /billing/verify attempt blocked",
      );
      res.status(403).json({ error: "Transaction does not belong to caller" });
      return;
    }

    const userId = metadataUserId ?? req.userId!;
    if (internalPlan) {
      await applyPurchase(userId, internalPlan, jobId, data, reference);
    }

    res.json({ success: true, status: "success", plan: internalPlan });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Verify failed");
    res.status(500).json({ error: err?.message ?? "Verify failed" });
  }
});

// POST /billing/cancel — vestigial. Nothing recurs anymore.
router.post("/billing/cancel", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    success: true,
    message: "Your purchases don't auto-renew — there's nothing to cancel.",
  });
});

/**
 * Apply a successful purchase to a user. Idempotent w.r.t. the txn reference
 * because the underlying Paystack reference is verified before we get here, and
 * the webhook + verify endpoint both call this with the same data.
 *
 * Granted entitlements:
 *   - lifetime → user.lifetime = true; unlock all locked jobs
 *   - day      → dayPassExpiresAt = now + 24h (extends if already active);
 *                unlock all locked jobs
 *   - single   → if jobId provided, unlock that job; otherwise +1 credit
 */
export async function applyPurchase(
  userId: string,
  internalPlan: PlanId,
  jobId: number | undefined,
  txData: any,
  reference: string,
): Promise<void> {
  const customerCode = txData.customer?.customer_code as string | undefined;
  const amountCents = txData.amount != null ? String(txData.amount) : null;

  // Idempotency guard: try to claim this Paystack reference. If another caller
  // (verify endpoint vs. webhook) already claimed it, bail out.
  const claimed = await db
    .insert(processedPaymentsTable)
    .values({
      reference,
      userId,
      internalPlan,
      amountCents,
    })
    .onConflictDoNothing()
    .returning({ reference: processedPaymentsTable.reference });
  if (claimed.length === 0) {
    logger.info({ reference, userId }, "Paystack reference already applied; skipping");
    return;
  }

  if (internalPlan === "lifetime") {
    await db
      .update(usersTable)
      .set({
        plan: "lifetime",
        lifetime: true,
        paystackCustomerCode: customerCode ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    await unlockAllLockedJobs(userId, "lifetime");
    return;
  }

  if (internalPlan === "day") {
    // Atomic 24h extension done in SQL so two concurrent purchases stack
    // correctly to 48h instead of clobbering each other to 24h.
    await db
      .update(usersTable)
      .set({
        plan: "day",
        dayPassExpiresAt: sql`CASE
          WHEN ${usersTable.dayPassExpiresAt} IS NOT NULL AND ${usersTable.dayPassExpiresAt} > NOW()
            THEN ${usersTable.dayPassExpiresAt} + interval '24 hours'
          ELSE NOW() + interval '24 hours'
        END`,
        paystackCustomerCode: customerCode ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    await unlockAllLockedJobs(userId, "day");
    return;
  }

  // single
  if (jobId != null) {
    // Try to unlock that specific job. If it's already unlocked (or doesn't
    // belong to the user), fall back to crediting the user instead.
    const [job] = await db
      .select()
      .from(masteringJobsTable)
      .where(
        and(
          eq(masteringJobsTable.id, jobId),
          eq(masteringJobsTable.userId, userId),
        ),
      );
    if (job && !job.downloadUnlocked) {
      await db
        .update(masteringJobsTable)
        .set({ downloadUnlocked: true, unlockMode: "credit" })
        .where(eq(masteringJobsTable.id, jobId));
      await db
        .update(usersTable)
        .set({
          plan: "payg",
          paystackCustomerCode: customerCode ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));
      // No credit added — paid for this specific master.
      return;
    }
  }

  // Generic single-master credit — atomic increment so the idempotency guard
  // is the single source of truth and we never read-modify-write user.credits.
  await db
    .update(usersTable)
    .set({
      plan: sql`CASE WHEN ${usersTable.lifetime} THEN 'lifetime' ELSE 'payg' END`,
      credits: sql`${usersTable.credits} + 1`,
      paystackCustomerCode: customerCode ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

async function unlockAllLockedJobs(userId: string, mode: "lifetime" | "day"): Promise<void> {
  await db
    .update(masteringJobsTable)
    .set({ downloadUnlocked: true, unlockMode: mode })
    .where(
      and(
        eq(masteringJobsTable.userId, userId),
        eq(masteringJobsTable.downloadUnlocked, false),
      ),
    );
}

export default router;
