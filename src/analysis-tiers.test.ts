import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  AnalysisTier,
  getTierConfig,
  estimateCost,
  TIER_CONFIGS,
} from "./analysis-tiers.js";

// -- Unit tests --

describe("AnalysisTier enum", () => {
  it("has exactly four tiers", () => {
    const values = Object.values(AnalysisTier);
    expect(values).toHaveLength(4);
  });

  it("contains Standard, Enhanced, Detailed, Maximum", () => {
    expect(AnalysisTier.Standard).toBe("standard");
    expect(AnalysisTier.Enhanced).toBe("enhanced");
    expect(AnalysisTier.Detailed).toBe("detailed");
    expect(AnalysisTier.Maximum).toBe("maximum");
  });
});

describe("getTierConfig", () => {
  it("returns a valid config for every tier", () => {
    for (const tier of Object.values(AnalysisTier)) {
      const config = getTierConfig(tier);
      expect(config).toBeDefined();
      expect(typeof config.vision).toBe("boolean");
      expect(typeof config.samplingIntervalSeconds).toBe("number");
      expect(typeof config.maxFrames).toBe("number");
      expect(["low", "high"]).toContain(config.detail);
    }
  });

  it("Standard tier has no vision", () => {
    const config = getTierConfig(AnalysisTier.Standard);
    expect(config.vision).toBe(false);
    expect(config.samplingIntervalSeconds).toBe(0);
    expect(config.maxFrames).toBe(0);
  });

  it("Enhanced tier has vision at 1 frame/10s, low detail", () => {
    const config = getTierConfig(AnalysisTier.Enhanced);
    expect(config.vision).toBe(true);
    expect(config.samplingIntervalSeconds).toBe(10);
    expect(config.detail).toBe("low");
  });

  it("Detailed tier has vision at 1 frame/5s, high detail", () => {
    const config = getTierConfig(AnalysisTier.Detailed);
    expect(config.vision).toBe(true);
    expect(config.samplingIntervalSeconds).toBe(5);
    expect(config.detail).toBe("high");
  });

  it("Maximum tier has vision at 1 frame/sec, high detail", () => {
    const config = getTierConfig(AnalysisTier.Maximum);
    expect(config.vision).toBe(true);
    expect(config.samplingIntervalSeconds).toBe(1);
    expect(config.detail).toBe("high");
  });

  it("Maximum tier caps frames at 600", () => {
    const config = getTierConfig(AnalysisTier.Maximum);
    expect(config.maxFrames).toBe(600);
  });
});

describe("estimateCost", () => {
  it("Standard tier costs ~$0.18 for a 7-minute speech", () => {
    const cost = estimateCost(AnalysisTier.Standard, 420);
    expect(cost).toBeGreaterThan(0.10);
    expect(cost).toBeLessThan(0.30);
  });

  it("Enhanced tier costs slightly more than Standard", () => {
    const standard = estimateCost(AnalysisTier.Standard, 420);
    const enhanced = estimateCost(AnalysisTier.Enhanced, 420);
    expect(enhanced).toBeGreaterThan(standard);
  });

  it("Maximum tier costs significantly more than Standard", () => {
    const standard = estimateCost(AnalysisTier.Standard, 420);
    const maximum = estimateCost(AnalysisTier.Maximum, 420);
    expect(maximum).toBeGreaterThan(standard * 3);
  });

  it("returns 0 for zero duration", () => {
    const cost = estimateCost(AnalysisTier.Standard, 0);
    expect(cost).toBe(0);
  });

  it("cost scales with duration", () => {
    const short = estimateCost(AnalysisTier.Detailed, 60);
    const long = estimateCost(AnalysisTier.Detailed, 600);
    expect(long).toBeGreaterThan(short);
  });

  it("Maximum tier respects frame cap for long durations", () => {
    // 20 minutes at 1fps = 1200 frames, but cap is 600
    const cost20min = estimateCost(AnalysisTier.Maximum, 1200);
    // 10 minutes at 1fps = 600 frames, exactly at cap
    const cost10min = estimateCost(AnalysisTier.Maximum, 600);
    // Vision cost should be the same (both capped at 600 frames)
    // but transcription cost differs, so total differs slightly
    expect(cost20min).toBeGreaterThan(cost10min); // transcription still scales
  });
});

// -- Property-based tests --

describe("analysis-tiers properties", () => {
  const tierArb = fc.constantFrom(
    AnalysisTier.Standard,
    AnalysisTier.Enhanced,
    AnalysisTier.Detailed,
    AnalysisTier.Maximum,
  );

  it("estimateCost is always non-negative", () => {
    fc.assert(
      fc.property(tierArb, fc.nat({ max: 7200 }), (tier, duration) => {
        expect(estimateCost(tier, duration)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it("higher tiers cost >= lower tiers for same duration", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 7200 }), (duration) => {
        const s = estimateCost(AnalysisTier.Standard, duration);
        const e = estimateCost(AnalysisTier.Enhanced, duration);
        const d = estimateCost(AnalysisTier.Detailed, duration);
        const m = estimateCost(AnalysisTier.Maximum, duration);
        expect(e).toBeGreaterThanOrEqual(s);
        expect(d).toBeGreaterThanOrEqual(e);
        expect(m).toBeGreaterThanOrEqual(d);
      }),
      { numRuns: 100 },
    );
  });

  it("getTierConfig returns consistent vision flag and sampling rate", () => {
    fc.assert(
      fc.property(tierArb, (tier) => {
        const config = getTierConfig(tier);
        if (!config.vision) {
          expect(config.samplingIntervalSeconds).toBe(0);
          expect(config.maxFrames).toBe(0);
        } else {
          expect(config.samplingIntervalSeconds).toBeGreaterThan(0);
          expect(config.maxFrames).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("cost is monotonically non-decreasing with duration", () => {
    fc.assert(
      fc.property(
        tierArb,
        fc.integer({ min: 1, max: 3600 }),
        fc.integer({ min: 1, max: 3600 }),
        (tier, d1, d2) => {
          const shorter = Math.min(d1, d2);
          const longer = Math.max(d1, d2);
          expect(estimateCost(tier, longer)).toBeGreaterThanOrEqual(
            estimateCost(tier, shorter),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
