import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  extractFrames,
  computeFrameCount,
  type FfmpegFrameRunner,
  type FrameExtractionResult,
} from "./frame-extractor.js";
import { AnalysisTier, getTierConfig } from "./analysis-tiers.js";

// -- Mock FfmpegFrameRunner --

function createMockRunner(frameFiles: string[] = []): FfmpegFrameRunner {
  return {
    extractFrames: vi.fn().mockResolvedValue(frameFiles),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

// -- computeFrameCount tests --

describe("computeFrameCount", () => {
  it("returns 0 for Standard tier (no vision)", () => {
    const config = getTierConfig(AnalysisTier.Standard);
    expect(computeFrameCount(300, config)).toBe(0);
  });

  it("returns correct count for Enhanced tier (10s intervals, 5 min video)", () => {
    const config = getTierConfig(AnalysisTier.Enhanced);
    // 300s / 10s = 30 frames
    expect(computeFrameCount(300, config)).toBe(30);
  });

  it("returns correct count for Detailed tier (5s intervals, 5 min video)", () => {
    const config = getTierConfig(AnalysisTier.Detailed);
    // 300s / 5s = 60 frames
    expect(computeFrameCount(300, config)).toBe(60);
  });

  it("returns correct count for Maximum tier (1s intervals, 5 min video)", () => {
    const config = getTierConfig(AnalysisTier.Maximum);
    // 300s / 1s = 300 frames, cap is 600, so 300
    expect(computeFrameCount(300, config)).toBe(300);
  });

  it("caps at maxFrames for long videos", () => {
    const config = getTierConfig(AnalysisTier.Maximum);
    // 1200s / 1s = 1200 frames, cap is 600
    expect(computeFrameCount(1200, config)).toBe(600);
  });

  it("returns 0 for zero duration", () => {
    const config = getTierConfig(AnalysisTier.Enhanced);
    expect(computeFrameCount(0, config)).toBe(0);
  });
});

// -- extractFrames tests --

describe("extractFrames", () => {
  it("returns empty result for Standard tier", async () => {
    const runner = createMockRunner();
    const result = await extractFrames({
      videoPath: "/tmp/test.mp4",
      durationSeconds: 300,
      tier: AnalysisTier.Standard,
      runner,
    });

    expect(result.frames).toEqual([]);
    expect(result.frameCount).toBe(0);
    expect(runner.extractFrames).not.toHaveBeenCalled();
  });

  it("calls runner with correct fps and maxFrames for Enhanced tier", async () => {
    const runner = createMockRunner(["/tmp/frames/frame-001.jpg"]);
    const result = await extractFrames({
      videoPath: "/tmp/test.mp4",
      durationSeconds: 300,
      tier: AnalysisTier.Enhanced,
      runner,
    });

    expect(runner.extractFrames).toHaveBeenCalledOnce();
    const args = (runner.extractFrames as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0]).toBe("/tmp/test.mp4");      // videoPath
    expect(args[1]).toBeCloseTo(0.1);            // fps = 1/10
    expect(args[2]).toBe(30);                    // frameCount
    expect(args[3]).toBe("low");                 // detail
    expect(result.frameCount).toBe(1);
    expect(result.frames).toHaveLength(1);
  });

  it("calls runner with correct fps for Maximum tier", async () => {
    const runner = createMockRunner([
      "/tmp/frames/frame-001.jpg",
      "/tmp/frames/frame-002.jpg",
    ]);
    const result = await extractFrames({
      videoPath: "/tmp/test.mp4",
      durationSeconds: 60,
      tier: AnalysisTier.Maximum,
      runner,
    });

    expect(runner.extractFrames).toHaveBeenCalledOnce();
    const args = (runner.extractFrames as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0]).toBe("/tmp/test.mp4");
    expect(args[1]).toBeCloseTo(1.0);    // fps = 1/1
    expect(args[2]).toBe(60);            // frameCount (< maxFrames 600)
    expect(args[3]).toBe("high");        // detail
    expect(result.frameCount).toBe(2);
  });

  it("returns frame file paths from the runner", async () => {
    const files = ["/tmp/a.jpg", "/tmp/b.jpg", "/tmp/c.jpg"];
    const runner = createMockRunner(files);
    const result = await extractFrames({
      videoPath: "/tmp/test.mp4",
      durationSeconds: 60,
      tier: AnalysisTier.Detailed,
      runner,
    });

    expect(result.frames).toEqual(files);
    expect(result.frameCount).toBe(3);
  });

  it("returns cleanup function from the runner", async () => {
    const runner = createMockRunner(["/tmp/a.jpg"]);
    const result = await extractFrames({
      videoPath: "/tmp/test.mp4",
      durationSeconds: 60,
      tier: AnalysisTier.Enhanced,
      runner,
    });

    await result.cleanup();
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  it("propagates runner errors", async () => {
    const runner = createMockRunner();
    (runner.extractFrames as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ffmpeg failed"),
    );

    await expect(
      extractFrames({
        videoPath: "/tmp/test.mp4",
        durationSeconds: 60,
        tier: AnalysisTier.Enhanced,
        runner,
      }),
    ).rejects.toThrow("ffmpeg failed");
  });
});

// -- Property-based tests --

describe("frame extraction properties", () => {
  const visionTierArb = fc.constantFrom(
    AnalysisTier.Enhanced,
    AnalysisTier.Detailed,
    AnalysisTier.Maximum,
  );

  it("frame count is always non-negative and <= maxFrames", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(AnalysisTier)),
        fc.integer({ min: 0, max: 7200 }),
        (tier, duration) => {
          const config = getTierConfig(tier);
          const count = computeFrameCount(duration, config);
          expect(count).toBeGreaterThanOrEqual(0);
          expect(count).toBeLessThanOrEqual(config.maxFrames);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("frame count is monotonically non-decreasing with duration up to cap", () => {
    fc.assert(
      fc.property(
        visionTierArb,
        fc.integer({ min: 0, max: 3600 }),
        fc.integer({ min: 0, max: 3600 }),
        (tier, d1, d2) => {
          const config = getTierConfig(tier);
          const shorter = Math.min(d1, d2);
          const longer = Math.max(d1, d2);
          expect(computeFrameCount(longer, config)).toBeGreaterThanOrEqual(
            computeFrameCount(shorter, config),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("higher tiers produce >= frames than lower tiers for same duration", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        (duration) => {
          const e = computeFrameCount(duration, getTierConfig(AnalysisTier.Enhanced));
          const d = computeFrameCount(duration, getTierConfig(AnalysisTier.Detailed));
          const m = computeFrameCount(duration, getTierConfig(AnalysisTier.Maximum));
          expect(d).toBeGreaterThanOrEqual(e);
          expect(m).toBeGreaterThanOrEqual(d);
        },
      ),
      { numRuns: 100 },
    );
  });
});
