import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = getAuth(req);
    const userId =
      (auth?.sessionClaims as any)?.userId || auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Lookup or create local user row
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      let email: string | null = null;
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        email =
          clerkUser.primaryEmailAddress?.emailAddress ??
          clerkUser.emailAddresses?.[0]?.emailAddress ??
          null;
      } catch (err) {
        logger.warn({ err, userId }, "Failed to fetch Clerk user details");
      }

      [user] = await db
        .insert(usersTable)
        .values({ id: userId, email })
        .onConflictDoNothing({ target: usersTable.id })
        .returning();

      if (!user) {
        // Race: another request created it
        [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, userId));
      }
    }

    req.userId = userId;
    req.userEmail = user?.email ?? undefined;
    next();
  } catch (err) {
    logger.error({ err }, "requireAuth failed");
    res.status(500).json({ error: "Auth check failed" });
  }
}
