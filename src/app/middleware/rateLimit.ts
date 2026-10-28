import { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Process-local limiter for auth abuse protection. Use a shared Redis limiter when scaling horizontally. */
export const rateLimit = (limit: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  const count = bucket.count;
  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));
  if (count > limit) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }
  return next();
};
