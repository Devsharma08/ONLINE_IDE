import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  max: 200,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests,Please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
