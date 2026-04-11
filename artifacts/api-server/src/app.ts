import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
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
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

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
