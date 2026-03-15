/**
 * Tests for the AI Timer role — deterministic timing analysis.
 * Issue: #74
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { TimerRole } from "./timer-role.js";
import type { RoleContext } from "../meeting-role.js";
import type { DeliveryMetrics, ClassifiedPause, TranscriptSegment } from "../types.js";

// ─── Test Helpers ───────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<DeliveryMetrics> = {}): DeliveryMetrics {
  return {
    durationSeconds: 420,
    durationFormatted: "7:00",
    totalWords: 980,
    wordsPerMinute: 140,
    fillerWords: [],
    fillerWordCount: 0,
    fillerWordFrequency: 0,
    pauseCount: 5,
    totalPauseDurationSeconds: 8,
    averagePauseDurationSeconds: 1.6,
    intentionalPauseCount: 3,
    hesitationPauseCount: 2,
    classifiedPauses: [],
    energyVariationCoefficient: 0.3,
    energyProfile: { windowDurationMs: 500, windows: [], coefficientOfVariation: 0.3, silenceThreshold: 0.01 },
    classifiedFillers: [],
    visualMetrics: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RoleContext> = {}): RoleContext {
  return {
    transcript: [{ text: "Hello world", startTime: 0, endTime: 5, words: [], isFinal: true }],
    metrics: "metrics" in overrides ? overrides.metrics ?? null : makeMetrics(),
    visualObservations: null,
    projectContext: null,
    consent: null,
    speakerName: "Alice",
    config: {},
    ...overrides,
  };
}

// ─── Unit Tests ─────────────────────────────────────────────────────────────────

describe("TimerRole", () => {
  const role = new TimerRole();

  it("has correct metadata", () => {
    expect(role.id).toBe("timer");
    expect(role.name).toBe("Timer");
    expect(role.requiredInputs).toContain("metrics");
  });

  it("throws when metrics are null", async () => {
    await expect(role.run(makeContext({ metrics: null }))).rejects.toThrow("requires metrics");
  });

  // ─── Zone Classification ────────────────────────────────────────────────

  describe("timing zones", () => {
    it("classifies green zone — within target range", async () => {
      // Default target: 5-7 minutes. 6 minutes = green.
      const result = await role.run(makeContext({
        metrics: makeMetrics({ durationSeconds: 360, durationFormatted: "6:00" }),
        config: { targetMinSeconds: 300, targetMaxSeconds: 420 },
      }));
      expect(result.report.data?.zone).toBe("green");
    });

    it("classifies yellow zone — within 30s buffer of target", async () => {
      // 4:40 is 20s under the 5:00 min → yellow
      const result = await role.run(makeContext({
        metrics: makeMetrics({ durationSeconds: 280, durationFormatted: "4:40" }),
        config: { targetMinSeconds: 300, targetMaxSeconds: 420 },
      }));
      expect(result.report.data?.zone).toBe("yellow");
    });

    it("classifies red zone — far outside target", async () => {
      // 3:00 is way under the 5:00 min → red
      const result = await role.run(makeContext({
        metrics: makeMetrics({ durationSeconds: 180, durationFormatted: "3:00" }),
        config: { targetMinSeconds: 300, targetMaxSeconds: 420 },
      }));
      expect(result.report.data?.zone).toBe("red");
    });

    it("classifies yellow zone — slightly over max", async () => {
      // 7:20 is 20s over the 7:00 max → yellow
      const result = await role.run(makeContext({
        metrics: makeMetrics({ durationSeconds: 440, durationFormatted: "7:20" }),
        config: { targetMinSeconds: 300, targetMaxSeconds: 420 },
      }));
      expect(result.report.data?.zone).toBe("yellow");
    });

    it("classifies red zone — far over max", async () => {
      // 9:00 is way over the 7:00 max → red
      const result = await role.run(makeContext({
        metrics: makeMetrics({ durationSeconds: 540, durationFormatted: "9:00" }),
        config: { targetMinSeconds: 300, targetMaxSeconds: 420 },
      }));
      expect(result.report.data?.zone).toBe("red");
    });

    it("uses default targets when not configured", async () => {
      const result = await role.run(makeContext());
      // Default 5-7 min, metrics has 7:00 → green (at the boundary)
      expect(result.report.data?.zone).toBe("green");
    });
  });

  // ─── Report Structure ───────────────────────────────────────────────────

  describe("report structure", () => {
    it("includes a title and at least 2 sections", async () => {
      const result = await role.run(makeContext());
      expect(result.report.title).toBe("Timer Report");
      expect(result.report.sections.length).toBeGreaterThanOrEqual(2);
    });

    it("includes timing summary section", async () => {
      const result = await role.run(makeContext());
      const summary = result.report.sections.find(s => s.heading === "Timing Summary");
      expect(summary).toBeDefined();
      expect(summary!.content).toContain("7:00");
    });

    it("includes pacing section with WPM", async () => {
      const result = await role.run(makeContext());
      const pacing = result.report.sections.find(s => s.heading === "Pacing");
      expect(pacing).toBeDefined();
      expect(pacing!.content).toContain("140");
    });

    it("includes pause analysis when pauses exist", async () => {
      const result = await role.run(makeContext({
        metrics: makeMetrics({ pauseCount: 5, intentionalPauseCount: 3, hesitationPauseCount: 2 }),
      }));
      const pauses = result.report.sections.find(s => s.heading === "Pause Analysis");
      expect(pauses).toBeDefined();
    });
  });

  // ─── Script ─────────────────────────────────────────────────────────────

  describe("script output", () => {
    it("produces a non-empty script", async () => {
      const result = await role.run(makeContext());
      expect(result.script.length).toBeGreaterThan(0);
    });

    it("mentions the speaker's name when available", async () => {
      const result = await role.run(makeContext({ speakerName: "Bob" }));
      expect(result.script).toContain("Bob");
    });

    it("uses generic reference when no speaker name", async () => {
      const result = await role.run(makeContext({ speakerName: null }));
      expect(result.script).toContain("the speaker");
    });

    it("mentions green zone achievement", async () => {
      const result = await role.run(makeContext({
        metrics: makeMetrics({ durationSeconds: 360, durationFormatted: "6:00" }),
        config: { targetMinSeconds: 300, targetMaxSeconds: 420 },
      }));
      expect(result.script).toMatch(/within|green|target/i);
    });
  });

  // ─── Report Data ────────────────────────────────────────────────────────

  describe("report data", () => {
    it("includes all expected data fields", async () => {
      const result = await role.run(makeContext());
      const data = result.report.data!;
      expect(data.durationSeconds).toBe(420);
      expect(data.wordsPerMinute).toBe(140);
      expect(data.zone).toBeDefined();
    });
  });

  // ─── Property-Based Tests ──────────────────────────────────────────────

  describe("property tests", () => {
    it("zone is always one of green/yellow/red", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 1800 }),
          fc.nat({ max: 600 }),
          fc.nat({ max: 600 }),
          async (duration, minTarget, rangeDelta) => {
            const maxTarget = minTarget + rangeDelta + 1;
            const result = await role.run(makeContext({
              metrics: makeMetrics({
                durationSeconds: duration,
                durationFormatted: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
              }),
              config: { targetMinSeconds: minTarget, targetMaxSeconds: maxTarget },
            }));
            expect(["green", "yellow", "red"]).toContain(result.report.data?.zone);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("roleId is always 'timer'", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 1800 }),
          async (duration) => {
            const result = await role.run(makeContext({
              metrics: makeMetrics({
                durationSeconds: duration,
                durationFormatted: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
              }),
            }));
            expect(result.roleId).toBe("timer");
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
