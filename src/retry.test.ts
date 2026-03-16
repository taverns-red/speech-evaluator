/**
 * Retry Utility Tests — Phase 7 Sprint 3 (#118)
 * TDD: Tests written first, then implementation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, isRetryableError, RetryableError } from "./retry.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns the result on first successful call", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError("server error"))
      .mockResolvedValueOnce("recovered");

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    // Advance past the backoff delay
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retry attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableError("always fails"));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    // Attach catch handler BEFORE advancing timers to prevent unhandled rejection
    const resultPromise = promise.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(200);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(RetryableError);
    expect((error as Error).message).toBe("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("bad request"));

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries errors marked as retryable via isRetryable property", async () => {
    const error = Object.assign(new Error("rate limited"), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      shouldRetry: (err) => {
        const status = (err as { status?: number }).status;
        return status === 429 || (status !== undefined && status >= 500);
      },
    });
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses exponential backoff", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError("fail 1"))
      .mockRejectedValueOnce(new RetryableError("fail 2"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 });
    await vi.advanceTimersByTimeAsync(10000);
    await promise;

    // The first retry delay should be around baseDelay (100ms + jitter)
    // The second retry delay should be around 2 * baseDelay (200ms + jitter)
    const retryDelays = setTimeoutSpy.mock.calls
      .filter(call => typeof call[1] === "number" && call[1] > 0)
      .map(call => call[1] as number);

    // At least 2 retry delays should have been scheduled
    expect(retryDelays.length).toBeGreaterThanOrEqual(2);
    // Second delay should be larger than first (exponential growth)
    if (retryDelays.length >= 2) {
      expect(retryDelays[1]).toBeGreaterThan(retryDelays[0]!);
    }

    setTimeoutSpy.mockRestore();
  });

  it("respects maxDelayMs cap", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError("fail"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { maxAttempts: 2, baseDelayMs: 10000, maxDelayMs: 500 });
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    const retryDelays = setTimeoutSpy.mock.calls
      .filter(call => typeof call[1] === "number" && call[1] > 0)
      .map(call => call[1] as number);

    // Delay should not exceed maxDelayMs + jitter
    for (const delay of retryDelays) {
      expect(delay).toBeLessThanOrEqual(600); // 500 + reasonable jitter
    }

    setTimeoutSpy.mockRestore();
  });
});

describe("isRetryableError", () => {
  it("returns true for RetryableError", () => {
    expect(isRetryableError(new RetryableError("test"))).toBe(true);
  });

  it("returns false for regular Error", () => {
    expect(isRetryableError(new Error("test"))).toBe(false);
  });

  it("returns true for errors with status 429", () => {
    const err = Object.assign(new Error("rate limit"), { status: 429 });
    expect(isRetryableError(err)).toBe(true);
  });

  it("returns true for errors with status 500+", () => {
    expect(isRetryableError(Object.assign(new Error(""), { status: 500 }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error(""), { status: 502 }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error(""), { status: 503 }))).toBe(true);
  });

  it("returns false for 4xx client errors (except 429)", () => {
    expect(isRetryableError(Object.assign(new Error(""), { status: 400 }))).toBe(false);
    expect(isRetryableError(Object.assign(new Error(""), { status: 401 }))).toBe(false);
    expect(isRetryableError(Object.assign(new Error(""), { status: 404 }))).toBe(false);
  });

  it("returns true for network errors (ECONNRESET, ETIMEDOUT)", () => {
    expect(isRetryableError(Object.assign(new Error(""), { code: "ECONNRESET" }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error(""), { code: "ETIMEDOUT" }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error(""), { code: "ECONNREFUSED" }))).toBe(true);
  });
});
