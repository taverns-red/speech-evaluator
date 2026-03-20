// Acoustic analysis tests for #124 — pitch, pace, prosodic indicators
import { describe, it, expect } from "vitest";
import { MetricsExtractor } from "./metrics-extractor.js";
import type { TranscriptSegment } from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Generate a PCM buffer of a pure sine wave at a given frequency.
 * PCM 16-bit signed little-endian mono.
 */
function generateSineWave(
  frequencyHz: number,
  durationMs: number,
  sampleRate: number = 16000,
  amplitude: number = 0.5,
): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * frequencyHz * t));
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, value)), i * 2);
  }
  return buf;
}

/** Generate a silent PCM buffer. */
function generateSilence(durationMs: number, sampleRate: number = 16000): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  return Buffer.alloc(numSamples * 2);
}

/** Helper to create transcript segments with word-level timestamps. */
function makeSegment(
  text: string,
  startTime: number,
  endTime: number,
  wordLevel: boolean = true,
): TranscriptSegment {
  const wordTexts = text.trim().split(/\s+/).filter((w) => w.length > 0);
  let words: TranscriptSegment["words"] = [];
  if (wordLevel && wordTexts.length > 0) {
    const wordDuration = (endTime - startTime) / wordTexts.length;
    words = wordTexts.map((w, i) => ({
      word: w,
      startTime: startTime + i * wordDuration,
      endTime: startTime + (i + 1) * wordDuration,
      confidence: 0.95,
    }));
  }
  return { text, startTime, endTime, words, isFinal: true };
}

// ─── computePitchProfile ────────────────────────────────────────────────────────

describe("MetricsExtractor - computePitchProfile", () => {
  const extractor = new MetricsExtractor();

  it("returns empty profile for empty audio", () => {
    const profile = extractor.computePitchProfile([]);
    expect(profile.f0Values).toEqual([]);
    expect(profile.minF0).toBe(0);
    expect(profile.maxF0).toBe(0);
    expect(profile.meanF0).toBe(0);
    expect(profile.voicedFraction).toBe(0);
  });

  it("returns empty profile for zero-length buffer", () => {
    const profile = extractor.computePitchProfile([Buffer.alloc(0)]);
    expect(profile.f0Values).toEqual([]);
    expect(profile.voicedFraction).toBe(0);
  });

  it("detects F0 of a pure 200 Hz sine wave within 10% tolerance", () => {
    // 200ms of 200 Hz sine — long enough for multiple analysis windows
    const audio = generateSineWave(200, 200);
    const profile = extractor.computePitchProfile([audio]);

    expect(profile.f0Values.length).toBeGreaterThan(0);
    expect(profile.voicedFraction).toBeGreaterThan(0);

    // Mean F0 should be close to 200 Hz (within 10%)
    expect(profile.meanF0).toBeGreaterThan(180);
    expect(profile.meanF0).toBeLessThan(220);
  });

  it("detects F0 of a 150 Hz sine within 10% tolerance", () => {
    const audio = generateSineWave(150, 300);
    const profile = extractor.computePitchProfile([audio]);

    expect(profile.voicedFraction).toBeGreaterThan(0.3);
    expect(profile.meanF0).toBeGreaterThan(135);
    expect(profile.meanF0).toBeLessThan(165);
  });

  it("reports low voicedFraction for silence", () => {
    const silence = generateSilence(200);
    const profile = extractor.computePitchProfile([silence]);

    // Most/all frames should be unvoiced
    expect(profile.voicedFraction).toBeLessThanOrEqual(0.1);
  });

  it("computes pitch range in semitones correctly for constant pitch", () => {
    // Pure tone = no variation, range should be small
    const audio = generateSineWave(200, 300);
    const profile = extractor.computePitchProfile([audio]);

    // Range should be near 0 for a constant pitch
    expect(profile.rangeSemitones).toBeLessThan(3);
  });

  it("computes stdDevF0 near 0 for constant pitch", () => {
    const audio = generateSineWave(200, 300);
    const profile = extractor.computePitchProfile([audio]);

    // Standard deviation should be small for a pure tone
    expect(profile.stdDevF0).toBeLessThan(20);
  });

  it("handles multiple audio chunks correctly", () => {
    const chunk1 = generateSineWave(200, 100);
    const chunk2 = generateSineWave(200, 100);
    const profile = extractor.computePitchProfile([chunk1, chunk2]);

    expect(profile.f0Values.length).toBeGreaterThan(0);
    expect(profile.meanF0).toBeGreaterThan(180);
    expect(profile.meanF0).toBeLessThan(220);
  });

  it("uses specified window duration", () => {
    const audio = generateSineWave(200, 300);
    const profile20ms = extractor.computePitchProfile([audio], 20);
    const profile50ms = extractor.computePitchProfile([audio], 50);

    // More windows with smaller window size
    expect(profile20ms.f0Values.length).toBeGreaterThan(profile50ms.f0Values.length);
    expect(profile20ms.windowDurationMs).toBe(20);
    expect(profile50ms.windowDurationMs).toBe(50);
  });
});

// ─── computePaceVariation ───────────────────────────────────────────────────────

describe("MetricsExtractor - computePaceVariation", () => {
  const extractor = new MetricsExtractor();

  it("returns empty result for empty segments", () => {
    const result = extractor.computePaceVariation([]);
    expect(result.localWPM).toEqual([]);
    expect(result.meanWPM).toBe(0);
    expect(result.variationCoefficient).toBe(0);
  });

  it("computes single-window result for short speeches", () => {
    // 10 words in 10 seconds = 60 WPM, shorter than default 30s window
    const segment = makeSegment("one two three four five six seven eight nine ten", 0, 10);
    const result = extractor.computePaceVariation([segment]);

    expect(result.localWPM.length).toBe(1);
    expect(result.meanWPM).toBeCloseTo(60, 0);
    expect(result.stdDevWPM).toBe(0);
    expect(result.variationCoefficient).toBe(0);
  });

  it("computes variation for multi-window speech", () => {
    // Simulate a 60-second speech with varying pace
    const seg1 = makeSegment(
      Array(50).fill("word").join(" "), // 50 words in 30s = 100 WPM
      0, 30,
    );
    const seg2 = makeSegment(
      Array(25).fill("word").join(" "), // 25 words in 30s = 50 WPM
      30, 60,
    );

    const result = extractor.computePaceVariation([seg1, seg2], 30, 10);

    expect(result.localWPM.length).toBeGreaterThan(1);
    expect(result.peakWPM).toBeGreaterThan(result.troughWPM);
    expect(result.variationCoefficient).toBeGreaterThan(0);
  });

  it("reports peakWPM >= troughWPM always", () => {
    const segment = makeSegment(
      Array(100).fill("word").join(" "),
      0, 60,
    );
    const result = extractor.computePaceVariation([segment], 20, 10);

    expect(result.peakWPM).toBeGreaterThanOrEqual(result.troughWPM);
  });

  it("handles segment-level fallback (no word timestamps)", () => {
    const segment = makeSegment("these are ten words in a five second span ok ok", 0, 5, false);
    const result = extractor.computePaceVariation([segment]);

    expect(result.localWPM.length).toBe(1);
    expect(result.meanWPM).toBeGreaterThan(0);
  });

  it("uses custom window and stride parameters", () => {
    const segment = makeSegment(
      Array(200).fill("word").join(" "),
      0, 120,
    );
    const result = extractor.computePaceVariation([segment], 20, 5);

    expect(result.windowDurationSeconds).toBe(20);
    expect(result.strideSeconds).toBe(5);
    expect(result.localWPM.length).toBeGreaterThan(10);
  });
});

// ─── computeProsodicIndicators ──────────────────────────────────────────────────

describe("MetricsExtractor - computeProsodicIndicators", () => {
  const extractor = new MetricsExtractor();

  it("returns empty result for empty audio", () => {
    const segment = makeSegment("hello world", 0, 1);
    const result = extractor.computeProsodicIndicators([], [segment]);

    expect(result.pitchJitter).toBe(0);
    expect(result.meanOnsetStrength).toBe(0);
    expect(result.onsetCount).toBe(0);
  });

  it("returns empty result for empty segments", () => {
    const audio = generateSineWave(200, 200);
    const result = extractor.computeProsodicIndicators([audio], []);

    expect(result.pitchJitter).toBe(0);
    expect(result.meanOnsetStrength).toBe(0);
    expect(result.onsetCount).toBe(0);
  });

  it("computes pitchJitter from speech audio", () => {
    // Pure tone should have low jitter
    const audio = generateSineWave(200, 500);
    const segment = makeSegment("hello world this is a test", 0, 0.5);
    const result = extractor.computeProsodicIndicators([audio], [segment]);

    // Jitter should be non-negative
    expect(result.pitchJitter).toBeGreaterThanOrEqual(0);
  });

  it("detects utterance onsets", () => {
    // Simulate audio with two utterances separated by silence
    const speech1 = generateSineWave(200, 500);
    const silence = generateSilence(500);
    const speech2 = generateSineWave(200, 500);
    const audio = Buffer.concat([speech1, silence, speech2]);

    // Two utterances with a gap > 300ms
    const seg1 = makeSegment("hello world", 0, 0.5);
    const seg2 = makeSegment("more words", 1.0, 1.5);

    const result = extractor.computeProsodicIndicators([audio], [seg1, seg2]);

    // Should detect at least 2 onsets (first word + after gap)
    expect(result.onsetCount).toBeGreaterThanOrEqual(2);
    expect(result.meanOnsetStrength).toBeGreaterThan(0);
  });

  it("first word always counts as an onset", () => {
    const audio = generateSineWave(200, 200);
    const segment = makeSegment("hello", 0, 0.2);
    const result = extractor.computeProsodicIndicators([audio], [segment]);

    expect(result.onsetCount).toBeGreaterThanOrEqual(1);
  });
});
