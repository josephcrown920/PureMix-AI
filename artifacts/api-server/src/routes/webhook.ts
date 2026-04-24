import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "../lib/paystack";
import { applyPlanFromTransaction } from "./billing";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// IMPORTANT: This route must be mounted with express.raw({ type: "*/*" }) BEFORE
// express.json() so we can verify the HMAC signature against the raw body.
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const raw = req.body as Buffer;
  const sig = req.header("x-paystack-signature");
  if (!verifyWebhookSignature(raw, sig)) {
    logger.warn("Paystack webhook: invalid signature");
    res.status(401).send("invalid signature");
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).send("bad json");
    return;
  }

  const event = payload?.event as string;
  const data = payload?.data ?? {};

  try {
    switch (event) {
      case "charge.success": {
        const userId = data.metadata?.userId as string | undefined;
        const internalPlan = data.metadata?.internalPlan as
          | "pro"
          | "lifetime"
          | undefined;
        if (userId && internalPlan) {
          await applyPlanFromTransaction(userId, internalPlan, data);
        }
        break;
      }
      case "subscription.create": {
        const customerCode = data.customer?.customer_code as string | undefined;
        if (customerCode) {
          const nextPaymentDate = data.next_payment_date
            ? new Date(data.next_payment_date)
            : null;
          await db
            .update(usersTable)
            .set({
              plan: "pro",
              paystackSubscriptionCode: data.subscription_code,
              paystackEmailToken: data.email_token,
              proRenewsAt: nextPaymentDate,
              updatedAt: new Date(),
            })
            .where(eq(usersTable.paystackCustomerCode, customerCode));
        }
        break;
      }
      case "invoice.payment_failed":
      case "subscription.not_renew":
      case "subscription.disable": {
        const customerCode = data.customer?.customer_code as string | undefined;
        if (customerCode) {
          // Find user; downgrade to free unless they have lifetime.
          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.paystackCustomerCode, customerCode));
          if (user) {
            await db
              .update(usersTable)
              .set({
                plan: user.lifetime ? "lifetime" : "free",
                paystackSubscriptionCode: null,
                paystackEmailToken: null,
                proRenewsAt: null,
                updatedAt: new Date(),
              })
              .where(eq(usersTable.id, user.id));
          }
        }
        break;
      }
      default:
        logger.debug({ event }, "Paystack webhook: unhandled event");
    }
  } catch (err) {
    logger.error({ err, event }, "Paystack webhook handler failed");
  }

  res.sendStatus(200);
});

export default router;
