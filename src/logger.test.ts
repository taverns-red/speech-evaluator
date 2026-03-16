// Logger — structured JSON logging for Cloud Run / Cloud Logging
// Phase 7 Sprint 1 (#118)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, LogLevel, setGlobalLogLevel, type Logger } from "./logger.js";

describe("logger", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    setGlobalLogLevel(LogLevel.DEBUG); // Allow all levels for testing
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    setGlobalLogLevel(LogLevel.INFO); // Reset to default
  });

  describe("createLogger", () => {
    it("should create a logger with a component name", () => {
      const log = createLogger("TestComponent");
      expect(log).toBeDefined();
      expect(typeof log.info).toBe("function");
      expect(typeof log.warn).toBe("function");
      expect(typeof log.error).toBe("function");
      expect(typeof log.debug).toBe("function");
    });
  });

  describe("output format", () => {
    it("should output a single JSON line per log call", () => {
      const log = createLogger("Server");
      log.info("Request received");

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output.endsWith("\n")).toBe(true);

      const parsed = JSON.parse(output.trim());
      expect(parsed).toBeDefined();
    });

    it("should include severity, component, message, and timestamp", () => {
      const log = createLogger("SessionManager");
      log.info("Session created");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.severity).toBe("INFO");
      expect(parsed.component).toBe("SessionManager");
      expect(parsed.message).toBe("Session created");
      expect(parsed.timestamp).toBeDefined();
      // Timestamp should be ISO 8601
      expect(() => new Date(parsed.timestamp)).not.toThrow();
    });

    it("should include metadata fields when provided", () => {
      const log = createLogger("SessionManager");
      log.info("Recording started", { sessionId: "abc-123", runId: 3 });

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.sessionId).toBe("abc-123");
      expect(parsed.runId).toBe(3);
    });

    it("should use correct severity for each level", () => {
      const log = createLogger("Test");

      log.debug("debug msg");
      log.info("info msg");
      log.warn("warn msg");
      log.error("error msg");

      const severities = stdoutSpy.mock.calls.map(
        (call) => JSON.parse((call[0] as string).trim()).severity
      );
      expect(severities).toEqual(["DEBUG", "INFO", "WARNING", "ERROR"]);
    });

    it("should use WARNING (not WARN) for Cloud Logging compatibility", () => {
      const log = createLogger("Test");
      log.warn("a warning");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      // Cloud Logging uses "WARNING" not "WARN"
      expect(parsed.severity).toBe("WARNING");
    });
  });

  describe("level filtering", () => {
    it("should suppress DEBUG when level is INFO", () => {
      setGlobalLogLevel(LogLevel.INFO);
      const log = createLogger("Test");

      log.debug("should be suppressed");
      expect(stdoutSpy).not.toHaveBeenCalled();

      log.info("should appear");
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });

    it("should suppress INFO and DEBUG when level is WARN", () => {
      setGlobalLogLevel(LogLevel.WARN);
      const log = createLogger("Test");

      log.debug("no");
      log.info("no");
      expect(stdoutSpy).not.toHaveBeenCalled();

      log.warn("yes");
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });

    it("should only allow ERROR when level is ERROR", () => {
      setGlobalLogLevel(LogLevel.ERROR);
      const log = createLogger("Test");

      log.debug("no");
      log.info("no");
      log.warn("no");
      expect(stdoutSpy).not.toHaveBeenCalled();

      log.error("yes");
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should include error name and stack when an Error is in metadata", () => {
      const log = createLogger("Test");
      const err = new Error("something broke");
      log.error("Operation failed", { error: err, sessionId: "xyz" });

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.error).toBe("something broke");
      expect(parsed.errorName).toBe("Error");
      expect(parsed.stack).toBeDefined();
      expect(parsed.sessionId).toBe("xyz");
    });

    it("should handle non-Error objects in error field gracefully", () => {
      const log = createLogger("Test");
      log.error("Failed", { error: "plain string error" });

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.error).toBe("plain string error");
    });
  });

  describe("child loggers", () => {
    it("should create a child logger with additional default metadata", () => {
      const log = createLogger("SessionManager");
      const child = log.child({ sessionId: "s-001" });

      child.info("Audio chunk received");

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.component).toBe("SessionManager");
      expect(parsed.sessionId).toBe("s-001");
      expect(parsed.message).toBe("Audio chunk received");
    });

    it("should merge child defaults with per-call metadata", () => {
      const log = createLogger("SessionManager");
      const child = log.child({ sessionId: "s-001" });

      child.info("Metrics computed", { wpm: 142 });

      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.sessionId).toBe("s-001");
      expect(parsed.wpm).toBe(142);
    });
  });
});
