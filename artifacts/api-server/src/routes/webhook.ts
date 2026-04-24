import { Router, type IRouter, type Request, type Response } from "express";
import { verifyWebhookSignature } from "../lib/paystack";
import { applyPurchase } from "./billing";
import { logger } from "../lib/logger";
import type { PlanId } from "../lib/plans";

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
        const internalPlan = data.metadata?.internalPlan as PlanId | undefined;
        const jobId = data.metadata?.jobId as number | undefined;
        if (userId && internalPlan) {
          await applyPurchase(userId, internalPlan, jobId, data);

          // Best-effort: trigger an email send if we just unlocked a job that
          // is already complete. The mastering processor handles the normal
          // case; this covers the "user paid AFTER mastering finished" path.
          await import("../lib/postPurchaseEmail")
            .then((m) => m.sendEmailsForRecentlyUnlockedJobs(userId))
            .catch((err) => logger.error({ err }, "post-purchase email failed"));
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
