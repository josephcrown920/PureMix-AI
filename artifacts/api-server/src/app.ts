import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import webhookRouter from "./routes/webhook";
import { generalLimiter, publicLimiter } from "./middlewares/rateLimit";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Clerk proxy (whitelabel) — must come before body parsers (streams raw bytes).
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS — allow same-origin (no Origin header), local dev, and any explicitly
// allowed Netlify/production domains via FRONTEND_ORIGINS (comma-separated).
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isProd = process.env.NODE_ENV === "production";
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / mobile
      if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (host === "localhost" || host === "127.0.0.1") return cb(null, true);
        if (host.endsWith(".replit.dev") || host.endsWith(".repl.co"))
          return cb(null, true);
        // In dev allow any Netlify preview; in prod require an explicit allow-list.
        if (!isProd && host.endsWith(".netlify.app")) return cb(null, true);
      } catch {
        /* ignore */
      }
      if (isProd) {
        return cb(new Error(`CORS: origin ${origin} not allowed`));
      }
      return cb(null, true);
    },
  }),
);

// Trust the Replit / Netlify reverse proxy so express-rate-limit and Clerk
// see the real client IP from X-Forwarded-For instead of the proxy's IP.
app.set("trust proxy", 1);

// Paystack webhook MUST be mounted before express.json so we can verify the
// HMAC signature against the raw request body. Scope the raw parser strictly
// to the webhook path so all other /api routes still get JSON parsing.
app.use(
  "/api/webhooks/paystack",
  publicLimiter,
  express.raw({ type: "*/*" }),
  webhookRouter,
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Only apply Clerk middleware to /api routes so the Vite dev-server proxy
// still works even when CLERK_SECRET_KEY isn't configured yet.
// Rate limit runs after Clerk so we can key by user ID when authenticated.
app.use("/api", clerkMiddleware(), generalLimiter, router);

// In production the API server also serves the built frontend so a single
// process can host the entire app on one origin. In development the frontend
// runs its own Vite dev server (see artifacts/music-mastering) which proxies
// /api back to this server.
if (process.env["NODE_ENV"] === "production") {
  const distPath = path.resolve(
    import.meta.dirname,
    "../../../artifacts/music-mastering/dist/public",
  );
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // Tiny landing page so hitting the API host directly during dev doesn't
  // look broken.
  app.get("/", (_req, res) => {
    res.type("html").send(
      "<html><body><h2>Puremix.ai API server</h2><p>The web app is served by Vite on its own port. Open the AI Music Mastering preview to see the app.</p></body></html>",
    );
  });
}

export default app;
