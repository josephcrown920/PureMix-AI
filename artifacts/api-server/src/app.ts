import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import webhookRouter from "./routes/webhook";
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

// Paystack webhook MUST be mounted before express.json so we can verify the
// HMAC signature against the raw request body. Scope the raw parser strictly
// to the webhook path so all other /api routes still get JSON parsing.
app.use(
  "/api/webhooks/paystack",
  express.raw({ type: "*/*" }),
  webhookRouter,
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Only apply Clerk middleware to /api routes so the Vite dev-server proxy
// still works even when CLERK_SECRET_KEY isn't configured yet.
app.use("/api", clerkMiddleware(), router);

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
  const vitePort = 5174;
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${vitePort}`,
      changeOrigin: true,
      ws: true,
      on: {
        error: (_err, _req, res) => {
          if (res && "writeHead" in res) {
            (res as import("http").ServerResponse).writeHead(503, {
              "Content-Type": "text/html",
            });
            (res as import("http").ServerResponse).end(
              "<html><body><h2>Frontend starting...</h2><script>setTimeout(()=>location.reload(),2000)</script></body></html>",
            );
          }
        },
      },
    }),
  );

  startViteDevServer(vitePort);
}

function startViteDevServer(port: number) {
  import("child_process").then(({ spawn }) => {
    const vite = spawn(
      "pnpm",
      ["--filter", "@workspace/music-mastering", "run", "dev"],
      {
        env: {
          ...process.env,
          PORT: String(port),
          BASE_PATH: "/",
          FORCE_COLOR: "1",
        },
        stdio: "inherit",
      },
    );
    vite.on("error", (err) => {
      logger.error({ err }, "Failed to start Vite dev server");
    });
    vite.on("exit", (code) => {
      logger.warn({ code }, "Vite dev server exited");
    });
    logger.info({ port }, "Starting Vite dev server");
  });
}

export default app;
