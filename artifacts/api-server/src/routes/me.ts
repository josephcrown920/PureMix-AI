import { Router, type IRouter } from "express";
import { db, usersTable, masteringJobsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { computeEntitlement } from "../lib/plans";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(masteringJobsTable)
    .where(eq(masteringJobsTable.userId, userId));

  const entitlement = computeEntitlement(user);

  res.json({
    id: user.id,
    email: user.email,
    plan: entitlement.label,
    lifetime: user.lifetime,
    entitlement,
    totalJobs: count ?? 0,
  });
});

export default router;
