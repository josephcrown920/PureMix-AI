import { Router, type IRouter } from "express";
import { db, usersTable, masteringJobsTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { PLANS, getJobLimit } from "../lib/plans";

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

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(masteringJobsTable)
    .where(
      and(
        eq(masteringJobsTable.userId, userId),
        gte(masteringJobsTable.createdAt, monthStart),
      ),
    );

  const plan = (user.plan ?? "free") as keyof typeof PLANS;
  const limit = getJobLimit(plan);

  res.json({
    id: user.id,
    email: user.email,
    plan,
    lifetime: user.lifetime,
    proRenewsAt: user.proRenewsAt?.toISOString() ?? null,
    usage: {
      monthlyJobs: count ?? 0,
      monthlyJobLimit: limit,
      remaining: limit == null ? null : Math.max(0, limit - (count ?? 0)),
      periodStart: monthStart.toISOString(),
    },
    planConfig: PLANS[plan],
  });
});

export default router;
