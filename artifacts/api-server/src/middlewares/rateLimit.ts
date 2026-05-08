import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/**
 * Per-user (when authenticated) or per-IP rate limiter for general /api routes.
 * Uses Clerk's req.auth().userId when available so that authenticated users
 * sharing an IP (e.g. office NAT) aren't penalized for each other.
 */
function authOrIpKey(req: Request): string {
  // @ts-expect-error — Clerk middleware attaches `auth()` at runtime
  const auth = typeof req.auth === "function" ? req.auth() : undefined;
  const userId = auth?.userId as string | undefined;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

/** General API limit: 120 requests per minute per user/IP. Generous so the
 * polling-heavy job-status UI doesn't trip it. */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: authOrIpKey,
  message: { error: "Too many requests. Slow down and try again in a minute." },
});

/** Stricter limiter for expensive write operations (uploads, checkout init). */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: authOrIpKey,
  message: {
    error: "Too many uploads. Please wait a minute before submitting another track.",
    code: "RATE_LIMITED",
  },
});

/** AI suggestion limiter — calls a paid LLM, so we cap per-user usage. */
export const aiSuggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: authOrIpKey,
  message: {
    error: "Too many AI suggestions. Wait a minute before asking again.",
    code: "RATE_LIMITED",
  },
});

/** Anti-abuse limiter for unauthenticated webhook-like endpoints. */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? "unknown")}`,
});
