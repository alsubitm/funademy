import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Login / registration: per-IP limit to blunt credential stuffing and
 * mass account creation. Successful requests are not counted so normal
 * users are unaffected.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً، حاول مرة أخرى لاحقاً" },
});

/**
 * PIN verification (parent gate + child profile select): 4-digit PINs are
 * trivially brute-forceable, so use a tight per-IP limit on failures.
 */
export const pinLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً، حاول مرة أخرى لاحقاً" },
});
