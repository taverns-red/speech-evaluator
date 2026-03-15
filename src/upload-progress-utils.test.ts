/**
 * Tests for frontend upload progress utility functions.
 *
 * These test the pure logic extracted from index.html's upload
 * progress UI. Since the frontend is inline JS in a single HTML file,
 * extracting pure functions into a module is the strategy for frontend
 * test coverage.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  computeSpeedAndETA,
  computePipelineStates,
  formatElapsed,
  PIPELINE_ORDER,
  PIPELINE_STAGE_MAP,
  type ProgressSample,
} from "./upload-progress-utils.js";

describe("computeSpeedAndETA", () => {
  it("returns null for first sample (insufficient data)", () => {
    const samples: ProgressSample[] = [];
    const result = computeSpeedAndETA(samples, 1000, 10000);
    expect(result.speed).toBeNull();
    expect(result.eta).toBeNull();
  });

  it("returns null if time delta is too small (<0.5s)", () => {
    const now = Date.now();
    const samples: ProgressSample[] = [{ time: now, loaded: 0 }];
    // Second sample < 0.5s later (same timestamp)
    const result = computeSpeedAndETA(samples, 5000, 10000);
    expect(result.speed).toBeNull();
  });

  it("computes speed and ETA with sufficient samples", () => {
    const samples: ProgressSample[] = [];
    const now = Date.now();

    // Simulate 1MB/s upload: 0 -> 1MB over 1 second
    samples.push({ time: now - 1000, loaded: 0 });
    const result = computeSpeedAndETA(samples, 1024 * 1024, 10 * 1024 * 1024);

    expect(result.speed).toBe("1.0 MB/s");
    expect(result.eta).toMatch(/~\d+s remaining/);
  });

  it("shows minutes for long ETAs", () => {
    const samples: ProgressSample[] = [];
    const now = Date.now();

    // Very slow: 100KB over 10 seconds = 10KB/s, 100MB remaining
    samples.push({ time: now - 10000, loaded: 0 });
    const result = computeSpeedAndETA(
      samples,
      100 * 1024,
      100 * 1024 * 1024,
    );

    expect(result.eta).toMatch(/~\d+ min remaining/);
  });

  it("keeps at most maxSamples entries", () => {
    const samples: ProgressSample[] = [];
    for (let i = 0; i < 10; i++) {
      computeSpeedAndETA(samples, i * 1000, 10000, 3);
    }
    expect(samples.length).toBe(3);
  });

  describe("property tests", () => {
    it("speed is null or a valid MB/s string", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100000000 }),
          fc.nat({ max: 100000000 }),
          (loaded, total) => {
            const samples: ProgressSample[] = [
              { time: Date.now() - 1000, loaded: 0 },
            ];
            const safeTotal = Math.max(total, loaded + 1);
            const result = computeSpeedAndETA(samples, loaded, safeTotal);
            if (result.speed !== null) {
              expect(result.speed).toMatch(/^\d+\.\d MB\/s$/);
            }
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});

describe("computePipelineStates", () => {
  it("all inactive for unknown stage", () => {
    const states = computePipelineStates("Unknown");
    expect(states.every((s) => s.state === "inactive")).toBe(true);
  });

  it("Uploading stage marks first step active", () => {
    const states = computePipelineStates("Uploading");
    expect(states[0]).toEqual({ step: "Uploading", state: "active" });
    expect(states[1].state).toBe("inactive");
  });

  it("Initializing maps to Uploading", () => {
    const states = computePipelineStates("Initializing");
    expect(states[0]).toEqual({ step: "Uploading", state: "active" });
  });

  it("Processing stage marks Uploading as completed, Extracting as active", () => {
    const states = computePipelineStates("Processing");
    expect(states[0]).toEqual({ step: "Uploading", state: "completed" });
    expect(states[1]).toEqual({ step: "Extracting", state: "active" });
  });

  it("Complete stage marks all preceding steps as completed", () => {
    const states = computePipelineStates("Complete");
    expect(states[0].state).toBe("completed");
    expect(states[1].state).toBe("completed");
    expect(states[2].state).toBe("completed");
    expect(states[3].state).toBe("completed");
    expect(states[4]).toEqual({ step: "Complete", state: "active" });
  });

  it("Analyzing maps to Evaluating", () => {
    const states = computePipelineStates("Analyzing");
    expect(states.find((s) => s.step === "Evaluating")?.state).toBe("active");
  });

  it("always returns entries for all pipeline steps", () => {
    for (const stage of Object.keys(PIPELINE_STAGE_MAP)) {
      const states = computePipelineStates(stage);
      expect(states.length).toBe(PIPELINE_ORDER.length);
    }
  });

  describe("property tests", () => {
    it("exactly one step is active for any known stage", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(PIPELINE_STAGE_MAP)),
          (stage) => {
            const states = computePipelineStates(stage);
            const activeCount = states.filter(
              (s) => s.state === "active",
            ).length;
            expect(activeCount).toBe(1);
          },
        ),
      );
    });

    it("completed steps always precede the active step", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(PIPELINE_STAGE_MAP)),
          (stage) => {
            const states = computePipelineStates(stage);
            const activeIdx = states.findIndex((s) => s.state === "active");
            for (let i = 0; i < activeIdx; i++) {
              expect(states[i].state).toBe("completed");
            }
            for (let i = activeIdx + 1; i < states.length; i++) {
              expect(states[i].state).toBe("inactive");
            }
          },
        ),
      );
    });
  });
});

describe("formatElapsed", () => {
  it("formats seconds only", () => {
    expect(formatElapsed(45)).toBe("45s");
  });

  it("formats zero seconds", () => {
    expect(formatElapsed(0)).toBe("0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(125)).toBe("2m 5s");
  });

  it("formats exact minutes", () => {
    expect(formatElapsed(60)).toBe("1m 0s");
  });

  describe("property tests", () => {
    it("always contains 's' suffix", () => {
      fc.assert(
        fc.property(fc.nat({ max: 36000 }), (secs) => {
          expect(formatElapsed(secs)).toMatch(/s$/);
        }),
        { numRuns: 50 },
      );
    });

    it("contains 'm' for values >= 60", () => {
      fc.assert(
        fc.property(fc.integer({ min: 60, max: 36000 }), (secs) => {
          expect(formatElapsed(secs)).toContain("m");
        }),
        { numRuns: 50 },
      );
    });
  });
});
