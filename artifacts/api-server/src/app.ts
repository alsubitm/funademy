import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind the Replit proxy; needed so rate limiting keys on the real client IP.
app.set("trust proxy", 1);

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
// Lock CORS to the app's own origins. Same-origin and non-browser requests
// (no Origin header) need no CORS headers; anything else must match the
// explicit allowlist derived from the Replit environment / CORS_ORIGINS.
const allowedOrigins = new Set<string>(
  [
    ...(process.env["CORS_ORIGINS"]?.split(",") ?? []),
    ...(process.env["REPLIT_DOMAINS"]?.split(",") ?? []),
    process.env["REPLIT_DEV_DOMAIN"] ?? "",
  ]
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (d.startsWith("http") ? d : `https://${d}`)),
);
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: same-origin or non-browser client — no CORS headers.
      if (!origin) return callback(null, false);
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
