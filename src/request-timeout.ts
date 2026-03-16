// Request Timeout Middleware — Phase 7 Sprint 2 (#118)
//
// Express middleware that returns 504 Gateway Timeout when a request
// exceeds a configurable duration. Prevents runaway API calls (e.g.
// stuck OpenAI requests) from holding connections indefinitely.
//
// Usage:
//   app.post("/api/upload", requestTimeout(300_000), uploadHandler);  // 5 min
//   app.get("/api/health", requestTimeout(5_000), healthHandler);     // 5 sec

import type { Request, Response, NextFunction } from "express";
import { createLogger } from "./logger.js";

const log = createLogger("RequestTimeout");

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Creates Express middleware that aborts the response with 504 if the handler
 * hasn't responded within `timeoutMs` milliseconds.
 */
export function requestTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        log.warn("Request timeout", { method: req.method, path: req.path, timeoutMs });
        res.status(504).json({ error: `Request timeout after ${timeoutMs}ms` });
      }
    }, timeoutMs);

    // Clean up timer when response finishes (prevents leaks)
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
