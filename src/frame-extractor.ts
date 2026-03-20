// Frame extraction for Vision tier analysis (#125)
//
// Extracts video frames at configurable intervals using ffmpeg.
// Uses DI via FfmpegFrameRunner interface (per Lesson 36 pattern).

import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { readdir, rm } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { type TierConfig, getTierConfig, type AnalysisTier } from "./analysis-tiers.js";

// -- DI Interface --

/**
 * Abstraction for ffmpeg frame extraction (testable via mock).
 * Real implementation calls fluent-ffmpeg; tests inject vi.fn() stubs.
 */
export interface FfmpegFrameRunner {
  /**
   * Extract frames from a video file.
   * @param videoPath  - Path to the input video
   * @param fps       - Frames per second to extract (e.g., 0.1 = 1 frame per 10s)
   * @param maxFrames - Maximum number of frames to extract
   * @param detail    - "low" (512px wide) or "high" (original resolution)
   * @returns Array of extracted frame file paths
   */
  extractFrames(
    videoPath: string,
    fps: number,
    maxFrames: number,
    detail: "low" | "high",
  ): Promise<string[]>;

  /** Clean up extracted frame files */
  cleanup(): Promise<void>;
}

// -- Frame Count Computation --

/**
 * Compute the number of frames to extract based on video duration and tier config.
 * Returns 0 if vision is disabled for the tier.
 */
export function computeFrameCount(durationSeconds: number, config: TierConfig): number {
  if (!config.vision || config.samplingIntervalSeconds <= 0 || durationSeconds <= 0) {
    return 0;
  }
  const rawFrames = Math.ceil(durationSeconds / config.samplingIntervalSeconds);
  return Math.min(rawFrames, config.maxFrames);
}

// -- Result Type --

export interface FrameExtractionResult {
  frames: string[];     // Paths to extracted frame files
  frameCount: number;
  cleanup: () => Promise<void>;  // Call to delete temp files
}

// -- Main Extraction Function --

export interface ExtractFramesOptions {
  videoPath: string;
  durationSeconds: number;
  tier: AnalysisTier;
  runner?: FfmpegFrameRunner;  // Optional — defaults to real ffmpeg runner
}

/**
 * Extract frames from a video file based on the configured analysis tier.
 * Returns empty result for Standard tier (no vision).
 */
export async function extractFrames(opts: ExtractFramesOptions): Promise<FrameExtractionResult> {
  const config = getTierConfig(opts.tier);

  // No vision = no frames
  if (!config.vision) {
    return { frames: [], frameCount: 0, cleanup: async () => {} };
  }

  const frameCount = computeFrameCount(opts.durationSeconds, config);
  if (frameCount === 0) {
    return { frames: [], frameCount: 0, cleanup: async () => {} };
  }

  const fps = 1 / config.samplingIntervalSeconds;
  const runner = opts.runner ?? createRealFfmpegRunner();

  const frames = await runner.extractFrames(opts.videoPath, fps, frameCount, config.detail);

  return {
    frames,
    frameCount: frames.length,
    cleanup: () => runner.cleanup(),
  };
}

// -- Real FFmpeg Runner --

/**
 * Create a real FfmpegFrameRunner that shells out to ffmpeg.
 * Extracts frames to a temp directory and returns file paths.
 */
export function createRealFfmpegRunner(): FfmpegFrameRunner {
  const outputDir = join(tmpdir(), `frames-${randomUUID()}`);
  let created = false;

  return {
    async extractFrames(
      videoPath: string,
      fps: number,
      maxFrames: number,
      detail: "low" | "high",
    ): Promise<string[]> {
      // Create output directory
      const { mkdir } = await import("fs/promises");
      await mkdir(outputDir, { recursive: true });
      created = true;

      const outputPattern = join(outputDir, "frame-%04d.jpg");

      // Build filter: fps + optional resize for low detail
      const filters: string[] = [`fps=${fps}`];
      if (detail === "low") {
        filters.push("scale=512:-1");
      }
      // Add frame limit via -frames:v
      const filterString = filters.join(",");

      return new Promise<string[]>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([
            `-vf`, filterString,
            `-frames:v`, String(maxFrames),
            `-q:v`, `2`,  // High quality JPEG
          ])
          .on("error", (err: Error) =>
            reject(new Error(`Frame extraction failed: ${err.message}`)),
          )
          .on("end", async () => {
            try {
              const files = await readdir(outputDir);
              const framePaths = files
                .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
                .sort()
                .map((f) => join(outputDir, f));
              resolve(framePaths);
            } catch (e) {
              reject(new Error(`Failed to read extracted frames: ${(e as Error).message}`));
            }
          })
          .save(outputPattern);
      });
    },

    async cleanup(): Promise<void> {
      if (created) {
        await rm(outputDir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}
