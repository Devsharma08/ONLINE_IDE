import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { executeCode } from "../services/codeExecution.js";

export const executeRouter: ExpressRouter = Router();

const executionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 15, // Limit each IP to 15 executions per minute
  message: {
    error: "Too many code executions launched from this IP. Please wait a minute before compiling again.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

executeRouter.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

executeRouter.post("/", executionLimiter, executeCode);
