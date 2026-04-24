import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { PLANS, CURRENCY } from "../lib/plans";
import {
  initializeTransaction,
  verifyTransaction,
  ensurePaystackPlan,
  disableSubscription,
} from "../lib/paystack";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/billing/plans", (_req, res): void => {
  res.json({
    currency: CURRENCY,
    plans: Object.values(PLANS),
  });
});

// POST /billing/checkout  body: { plan: 'pro' | 'lifetime', returnUrl: string }
router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  const { plan, returnUrl } = req.body ?? {};
  if (plan !== "pro" && plan !== "lifetime") {
    res.status(400).json({ error: "plan must be 'pro' or 'lifetime'" });
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

  const cfg = PLANS[plan as "pro" | "lifetime"];

  try {
    let paystackPlanCode: string | undefined;
    if (plan === "pro") {
      paystackPlanCode = await ensurePaystackPlan("pro", cfg.priceCents, cfg.currency);
    }

    const result = await initializeTransaction({
      email,
      amountCents: cfg.priceCents,
      currency: cfg.currency,
      callbackUrl: returnUrl,
      plan: paystackPlanCode,
      metadata: { userId, internalPlan: plan },
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

    const userId = (data.metadata as any)?.userId ?? req.userId;
    const internalPlan = (data.metadata as any)?.internalPlan as
      | "pro"
      | "lifetime"
      | undefined;

    if (userId && internalPlan) {
      await applyPlanFromTransaction(userId, internalPlan, data);
    }

    res.json({ success: true, status: "success" });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Verify failed");
    res.status(500).json({ error: err?.message ?? "Verify failed" });
  }
});

// POST /billing/cancel — disable Pro subscription
router.post("/billing/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.paystackSubscriptionCode || !user?.paystackEmailToken) {
    res.status(400).json({ error: "No active subscription to cancel" });
    return;
  }
  try {
    await disableSubscription({
      code: user.paystackSubscriptionCode,
      token: user.paystackEmailToken,
    });
    await db
      .update(usersTable)
      .set({
        plan: user.lifetime ? "lifetime" : "free",
        paystackSubscriptionCode: null,
        paystackEmailToken: null,
        proRenewsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Cancel failed");
    res.status(500).json({ error: err?.message ?? "Cancel failed" });
  }
});

export async function applyPlanFromTransaction(
  userId: string,
  internalPlan: "pro" | "lifetime",
  txData: any,
): Promise<void> {
  const customerCode = txData.customer?.customer_code as string | undefined;

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
    return;
  }

  // pro: subscription details arrive via webhook (subscription.create).
  // For immediate UX, set plan='pro' now.
  await db
    .update(usersTable)
    .set({
      plan: "pro",
      paystackCustomerCode: customerCode ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

export default router;
