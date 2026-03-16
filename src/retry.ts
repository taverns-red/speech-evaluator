// Retry utility with exponential backoff + jitter
// Phase 7 Sprint 3 (#118)
//
// Generic wrapper for async functions that call external APIs.
// Retries transient errors (5xx, 429, network) with exponential backoff.
// Does NOT retry client errors (4xx except 429) or validation failures.

import { createLogger } from "./logger.js";

const log = createLogger("Retry");

// ─── Retryable error classification ─────────────────────────────────────────────

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "EAI_AGAIN",
]);

/**
 * An error that should always be retried.
 * Throw this from your function to signal a transient failure.
 */
export class RetryableError extends Error {
  readonly isRetryable = true;
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Determines whether an error is transient and should be retried.
 *
 * Retryable:
 *   - RetryableError instances
 *   - HTTP 429 (rate limit)
 *   - HTTP 500-599 (server errors)
 *   - Network errors (ECONNRESET, ETIMEDOUT, etc.)
 *
 * Not retryable:
 *   - HTTP 400-499 (except 429) — client errors
 *   - Validation/logic errors
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof RetryableError) return true;
  if (err && typeof err === "object") {
    const status = (err as { status?: number }).status;
    if (status === 429) return true;
    if (status !== undefined && status >= 500 && status < 600) return true;
    const code = (err as { code?: string }).code;
    if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;
  }
  return false;
}

// ─── Retry options ──────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms for the first retry. Default: 500 */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 5000 */
  maxDelayMs?: number;
  /** Custom retry predicate. Default: isRetryableError */
  shouldRetry?: (err: unknown) => boolean;
  /** Label for log messages. Default: "unknown" */
  label?: string;
}

// ─── Core retry function ────────────────────────────────────────────────────────

/**
 * Wraps an async function with retry logic using exponential backoff + jitter.
 *
 * @param fn — The async function to call
 * @param options — Retry configuration
 * @returns The result of `fn` on success
 * @throws The last error if all attempts are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    shouldRetry = isRetryableError,
    label = "unknown",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry non-retryable errors
      if (!shouldRetry(err)) {
        throw err;
      }

      // Don't retry if this was the last attempt
      if (attempt >= maxAttempts) {
        break;
      }

      // Exponential backoff with jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * baseDelayMs * 0.5;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      log.warn("Retrying after transient error", {
        label,
        attempt,
        maxAttempts,
        delayMs: Math.round(delay),
        error: err instanceof Error ? err.message : String(err),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
