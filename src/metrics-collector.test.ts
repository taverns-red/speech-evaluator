// Metrics Collector — in-memory performance counters
// Phase 7 Sprint 1 (#118)

import { describe, it, expect, beforeEach } from "vitest";
import {
  MetricsCollector,
  createMetricsCollector,
} from "./metrics-collector.js";

describe("MetricsCollector", () => {
  let mc: MetricsCollector;

  beforeEach(() => {
    mc = createMetricsCollector();
  });

  describe("counters", () => {
    it("should start all counters at zero", () => {
      const snapshot = mc.snapshot();
      expect(snapshot.sessionsTotal).toBe(0);
      expect(snapshot.evaluationsTotal).toBe(0);
      expect(snapshot.transcriptionErrorsTotal).toBe(0);
      expect(snapshot.ttsErrorsTotal).toBe(0);
    });

    it("should increment individual counters", () => {
      mc.incrementSessions();
      mc.incrementSessions();
      mc.incrementEvaluations();

      const snapshot = mc.snapshot();
      expect(snapshot.sessionsTotal).toBe(2);
      expect(snapshot.evaluationsTotal).toBe(1);
    });

    it("should increment error counters independently", () => {
      mc.incrementTranscriptionErrors();
      mc.incrementTranscriptionErrors();
      mc.incrementTTSErrors();

      const snapshot = mc.snapshot();
      expect(snapshot.transcriptionErrorsTotal).toBe(2);
      expect(snapshot.ttsErrorsTotal).toBe(1);
    });
  });

  describe("API call tracking", () => {
    it("should track API calls by provider", () => {
      mc.incrementApiCalls("deepgram");
      mc.incrementApiCalls("deepgram");
      mc.incrementApiCalls("openai");

      const snapshot = mc.snapshot();
      expect(snapshot.apiCallsByProvider.deepgram).toBe(2);
      expect(snapshot.apiCallsByProvider.openai).toBe(1);
    });

    it("should return 0 for providers with no calls", () => {
      const snapshot = mc.snapshot();
      expect(snapshot.apiCallsByProvider).toEqual({});
    });
  });

  describe("evaluation latency", () => {
    it("should compute percentiles from recorded latencies", () => {
      // Record 100 latencies: 1ms, 2ms, ..., 100ms
      for (let i = 1; i <= 100; i++) {
        mc.recordEvaluationLatency(i);
      }

      const snapshot = mc.snapshot();
      expect(snapshot.evaluationLatencyP50).toBe(50);
      expect(snapshot.evaluationLatencyP90).toBe(90);
      expect(snapshot.evaluationLatencyP99).toBe(99);
    });

    it("should return null percentiles when no latencies recorded", () => {
      const snapshot = mc.snapshot();
      expect(snapshot.evaluationLatencyP50).toBeNull();
      expect(snapshot.evaluationLatencyP90).toBeNull();
      expect(snapshot.evaluationLatencyP99).toBeNull();
    });

    it("should handle a single latency value", () => {
      mc.recordEvaluationLatency(42);

      const snapshot = mc.snapshot();
      expect(snapshot.evaluationLatencyP50).toBe(42);
      expect(snapshot.evaluationLatencyP90).toBe(42);
      expect(snapshot.evaluationLatencyP99).toBe(42);
    });

    it("should cap stored latencies to prevent unbounded memory growth", () => {
      // Record 2000 latencies — should only keep the most recent 1000
      for (let i = 1; i <= 2000; i++) {
        mc.recordEvaluationLatency(i);
      }

      const snapshot = mc.snapshot();
      // P50 should be based on the most recent 1000 values (1001..2000)
      expect(snapshot.evaluationLatencyP50).toBe(1500);
    });
  });

  describe("uptime", () => {
    it("should report uptime in seconds", () => {
      const snapshot = mc.snapshot();
      expect(typeof snapshot.uptimeSeconds).toBe("number");
      expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
