import cors from "cors";
import express, { type Express, type NextFunction } from "express";
import type { Request, Response } from "express";
import { executeRouter } from "./routes/execute.js";
import { githubRouter } from "./routes/github.js";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const getAllowedOrigins = () => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS);
};

const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

export const createApp = (): Express => {
  const app = express();
  app.set("trust proxy", 1); // Trust first proxy (Nginx) for secure header validation
  const allowedOrigins = getAllowedOrigins();

  app.disable("x-powered-by"); // Hide Express signature profiling headers
  app.use(securityHeaders);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const isAllowed = allowedOrigins.has(origin) || origin.endsWith(".vercel.app");
      callback(null, isAllowed);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "100kb", strict: true }));
  app.use("/api/execute", executeRouter);
  app.use("/api/github", githubRouter);

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    const typedError = error as { type?: string; status?: number };

    if (typedError.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large" });
    }

    if (error instanceof SyntaxError && typedError.status === 400) {
      return res.status(400).json({ error: "Invalid JSON request body" });
    }

    console.error("Unhandled API error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
};
