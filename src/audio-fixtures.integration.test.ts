/**
 * Integration tests using real audio fixtures (#141).
 *
 * These tests process actual audio files through MetricsExtractor
 * to verify the pipeline works with real media, not just mocks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MetricsExtractor } from "./metrics-extractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, "..", "test-fixtures");

/**
 * Convert an MP3 fixture to raw PCM 16-bit LE mono 16kHz using ffmpeg.
 * Returns a Buffer of raw PCM samples.
 */
function mp3ToRawPCM(fixtureName: string): Buffer {
  const filePath = resolve(FIXTURES_DIR, fixtureName);
  // ffmpeg outputs raw PCM to stdout
  const raw = execSync(
    `ffmpeg -i "${filePath}" -f s16le -acodec pcm_s16le -ar 16000 -ac 1 - 2>/dev/null`,
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return Buffer.from(raw);
}

/**
 * Check if ffmpeg is available.
 */
function ffmpegAvailable(): boolean {
  try {
    execSync("which ffmpeg", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const HAS_FFMPEG = ffmpegAvailable();

describe("Audio Fixture Integration Tests (#141)", () => {
  const extractor = new MetricsExtractor();

  describe("computeEnergyProfile with real audio", () => {
    it.skipIf(!HAS_FFMPEG)(
      "should produce non-zero energy windows for tone-speech.mp3",
      () => {
        const pcm = mp3ToRawPCM("tone-speech.mp3");

        // Should have PCM data (5s × 16000 Hz × 2 bytes = ~160000 bytes)
        expect(pcm.length).toBeGreaterThan(100_000);

        const profile = extractor.computeEnergyProfile([pcm]);

        // Should produce energy windows
        expect(profile.windows.length).toBeGreaterThan(0);
        // coefficientOfVariation should be a finite number
        expect(Number.isFinite(profile.coefficientOfVariation)).toBe(true);
        // At least some windows should have non-zero energy (it's a tone, not silence)
        const nonZeroWindows = profile.windows.filter((w) => w > 0);
        expect(nonZeroWindows.length).toBeGreaterThan(0);
        // Max normalized value should be 1.0 (normalization by max)
        expect(Math.max(...profile.windows)).toBeCloseTo(1.0, 5);
      },
    );

    it.skipIf(!HAS_FFMPEG)(
      "should produce all-zero or near-zero energy for silence.mp3",
      () => {
        const pcm = mp3ToRawPCM("silence.mp3");

        // Should have PCM data (3s × 16000 Hz × 2 bytes = ~96000 bytes)
        expect(pcm.length).toBeGreaterThan(50_000);

        const profile = extractor.computeEnergyProfile([pcm]);

        // Should produce windows
        expect(profile.windows.length).toBeGreaterThan(0);

        // For silence, all raw RMS values should be near zero
        // After normalization: either all zeros (truly silent) or very low variance
        // MP3 encoding may introduce very small noise, so check CV is low
        // A truly silent file should have all windows at 0 or identical
        if (Math.max(...profile.windows) === 0) {
          // Perfect silence — all zeros
          expect(profile.coefficientOfVariation).toBe(0);
        } else {
          // MP3 codec noise — CV should be very low (flat signal)
          expect(profile.coefficientOfVariation).toBeLessThan(0.5);
        }
      },
    );

    it.skipIf(!HAS_FFMPEG)(
      "should produce distinct profiles for tone vs silence",
      () => {
        const tonePcm = mp3ToRawPCM("tone-speech.mp3");
        const silencePcm = mp3ToRawPCM("silence.mp3");

        const toneProfile = extractor.computeEnergyProfile([tonePcm]);
        const silenceProfile = extractor.computeEnergyProfile([silencePcm]);

        // Tone should have more windows (5s vs 3s)
        expect(toneProfile.windows.length).toBeGreaterThan(
          silenceProfile.windows.length,
        );

        // The tone's max RMS should be normalized to 1.0
        expect(Math.max(...toneProfile.windows)).toBeCloseTo(1.0, 5);

        // Mean energy of tone windows should be much higher than silence windows
        const toneMean =
          toneProfile.windows.reduce((a, b) => a + b, 0) /
          toneProfile.windows.length;
        const silenceMean =
          silenceProfile.windows.reduce((a, b) => a + b, 0) /
          (silenceProfile.windows.length || 1);

        // Tone mean should be at least 10x silence mean (or silence mean is ~0)
        if (silenceMean > 0) {
          expect(toneMean / silenceMean).toBeGreaterThan(5);
        } else {
          expect(toneMean).toBeGreaterThan(0);
        }
      },
    );
  });

  describe("extract with empty segments", () => {
    it("should return empty metrics for no segments", () => {
      const metrics = extractor.extract([]);
      expect(metrics.durationSeconds).toBe(0);
      expect(metrics.totalWords).toBe(0);
      expect(metrics.wordsPerMinute).toBe(0);
      expect(metrics.fillerWordCount).toBe(0);
    });
  });

  describe("computeEnergyProfile with chunked audio", () => {
    it.skipIf(!HAS_FFMPEG)(
      "should produce same result whether audio is one buffer or split into chunks",
      () => {
        const pcm = mp3ToRawPCM("tone-speech.mp3");

        // Single buffer
        const singleProfile = extractor.computeEnergyProfile([pcm]);

        // Split into 4 chunks (like real streaming audio)
        const chunkSize = Math.floor(pcm.length / 4);
        const chunks = [
          pcm.subarray(0, chunkSize),
          pcm.subarray(chunkSize, chunkSize * 2),
          pcm.subarray(chunkSize * 2, chunkSize * 3),
          pcm.subarray(chunkSize * 3),
        ];
        const chunkedProfile = extractor.computeEnergyProfile(chunks);

        // Should produce same number of windows
        expect(chunkedProfile.windows.length).toBe(singleProfile.windows.length);
        // CV should be the same (same data, different chunking)
        expect(chunkedProfile.coefficientOfVariation).toBeCloseTo(
          singleProfile.coefficientOfVariation,
          5,
        );
      },
    );
  });
});
