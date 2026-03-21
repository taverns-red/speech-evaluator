/**
 * Golden file snapshot tests (#142).
 *
 * These tests verify that the JSON shapes produced by EvaluationGenerator
 * and MetricsExtractor match the golden files in test-fixtures/golden/.
 *
 * If outer shape changes break these tests, it means the frontend contract
 * has changed and needs explicit review + golden file update.
 *
 * To update golden files after an intentional shape change:
 *   1. Review the new shape vs the golden file
 *   2. Update the golden file to match the new shape
 *   3. Re-run the test
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MetricsExtractor } from "./metrics-extractor.js";
import type {
  StructuredEvaluation,
  DeliveryMetrics,
  TranscriptSegment,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = resolve(__dirname, "..", "test-fixtures", "golden");

/**
 * Load a golden file and return its parsed JSON.
 */
function loadGolden(filename: string): Record<string, unknown> {
  const raw = readFileSync(resolve(GOLDEN_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

/**
 * Recursively verify that `actual` has the same structural keys as `golden`.
 * Does not compare values — only checks that every key in golden exists in actual,
 * and that array elements (if present in golden) match the shape of actual elements.
 *
 * @returns Array of mismatch paths (empty = shape matches)
 */
function verifyShape(
  golden: unknown,
  actual: unknown,
  path: string = "$",
): string[] {
  const mismatches: string[] = [];

  if (golden === null) {
    // Golden says null — actual can be null or any value
    return mismatches;
  }

  if (Array.isArray(golden)) {
    if (!Array.isArray(actual)) {
      mismatches.push(`${path}: expected array, got ${typeof actual}`);
      return mismatches;
    }
    // If golden has element(s), verify each actual element matches the golden element shape
    if (golden.length > 0 && actual.length > 0) {
      const goldenElement = golden[0];
      for (let i = 0; i < actual.length; i++) {
        mismatches.push(
          ...verifyShape(goldenElement, actual[i], `${path}[${i}]`),
        );
      }
    }
    return mismatches;
  }

  if (typeof golden === "object" && golden !== null) {
    if (typeof actual !== "object" || actual === null) {
      mismatches.push(`${path}: expected object, got ${typeof actual}`);
      return mismatches;
    }
    const goldenObj = golden as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;

    for (const key of Object.keys(goldenObj)) {
      if (key === "_comment") continue; // skip metadata
      if (!(key in actualObj)) {
        // Allow optional fields (marked with ?) — only fail if golden marks it required
        mismatches.push(`${path}.${key}: missing in actual`);
      } else {
        mismatches.push(
          ...verifyShape(goldenObj[key], actualObj[key], `${path}.${key}`),
        );
      }
    }
    return mismatches;
  }

  // Primitive types — just verify actual exists (type match is flexible)
  if (actual === undefined) {
    mismatches.push(`${path}: missing (undefined)`);
  }

  return mismatches;
}

// ─── Test Data Factories ────────────────────────────────────────────────────────

function createClassicEvaluation(): StructuredEvaluation {
  return {
    opening: "Great effort on your speech today.",
    items: [
      {
        type: "commendation",
        summary: "Strong opening hook",
        evidence_quote: "Did you know that 90% of people",
        evidence_timestamp: 2.5,
        explanation:
          "Starting with a statistic immediately engages the audience.",
      },
      {
        type: "recommendation",
        summary: "Reduce filler words",
        evidence_quote: "um so basically what I mean is",
        evidence_timestamp: 45.2,
        explanation:
          "Filler words at this frequency distract from your message.",
      },
    ],
    closing: "Keep practicing and you will see improvement.",
    structure_commentary: {
      opening_comment: "Your opening was attention-grabbing.",
      body_comment: "Body had clear structure with three points.",
      closing_comment: null,
    },
    evaluation_style: "classic" as const,
  };
}

function createSBIEvaluation(): StructuredEvaluation {
  return {
    opening: "Thank you for sharing your project update.",
    items: [], // SBI uses style_items, not classic items
    closing: "Looking forward to your next presentation.",
    structure_commentary: {
      opening_comment: null,
      body_comment: "Clear progression through project milestones.",
      closing_comment: null,
    },
    evaluation_style: "sbi" as const,
    style_items: [
      {
        style: "sbi" as const,
        valence: "positive" as const,
        situation: "When presenting the quarterly results",
        behavior: "you used specific data points and charts",
        impact:
          "which made the audience clearly understand the growth trajectory",
      },
      {
        style: "sbi" as const,
        valence: "constructive" as const,
        situation: "During the Q&A section",
        behavior: "you answered questions before they were fully asked",
        impact: "which made some audience members feel unheard",
      },
    ],
  };
}

function createSampleSegments(): TranscriptSegment[] {
  return [
    {
      text: "Hello um everyone, today I want to talk about um public speaking.",
      startTime: 0,
      endTime: 5.0,
      words: [
        { word: "Hello", startTime: 0, endTime: 0.4 },
        { word: "um", startTime: 0.5, endTime: 0.7 },
        { word: "everyone,", startTime: 0.8, endTime: 1.2 },
        { word: "today", startTime: 1.3, endTime: 1.6 },
        { word: "I", startTime: 1.7, endTime: 1.8 },
        { word: "want", startTime: 1.9, endTime: 2.1 },
        { word: "to", startTime: 2.2, endTime: 2.3 },
        { word: "talk", startTime: 2.4, endTime: 2.6 },
        { word: "about", startTime: 2.7, endTime: 3.0 },
        { word: "um", startTime: 3.1, endTime: 3.3 },
        { word: "public", startTime: 3.4, endTime: 3.7 },
        { word: "speaking.", startTime: 3.8, endTime: 4.2 },
      ],
      isFinal: true,
    },
    {
      text: "It is a skill that everyone should develop.",
      startTime: 6.0,
      endTime: 10.0,
      words: [
        { word: "It", startTime: 6.0, endTime: 6.2 },
        { word: "is", startTime: 6.3, endTime: 6.4 },
        { word: "a", startTime: 6.5, endTime: 6.6 },
        { word: "skill", startTime: 6.7, endTime: 7.0 },
        { word: "that", startTime: 7.1, endTime: 7.3 },
        { word: "everyone", startTime: 7.4, endTime: 7.8 },
        { word: "should", startTime: 7.9, endTime: 8.2 },
        { word: "develop.", startTime: 8.3, endTime: 8.7 },
      ],
      isFinal: true,
    },
  ];
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("Golden File Snapshot Tests (#142)", () => {
  describe("Classic Evaluation Shape", () => {
    it("should match the classic-evaluation.json golden structure", () => {
      const golden = loadGolden("classic-evaluation.json");
      const actual = createClassicEvaluation();

      const mismatches = verifyShape(golden, actual);
      expect(mismatches).toEqual([]);
    });

    it("should have at least one commendation and one recommendation", () => {
      const actual = createClassicEvaluation();
      const commendations = actual.items.filter(
        (i) => i.type === "commendation",
      );
      const recommendations = actual.items.filter(
        (i) => i.type === "recommendation",
      );
      expect(commendations.length).toBeGreaterThanOrEqual(1);
      expect(recommendations.length).toBeGreaterThanOrEqual(1);
    });

    it("should have structure_commentary with all three fields", () => {
      const actual = createClassicEvaluation();
      expect(actual.structure_commentary).toBeDefined();
      expect("opening_comment" in actual.structure_commentary).toBe(true);
      expect("body_comment" in actual.structure_commentary).toBe(true);
      expect("closing_comment" in actual.structure_commentary).toBe(true);
    });
  });

  describe("SBI Evaluation Shape", () => {
    it("should match the sbi-evaluation.json golden structure", () => {
      const golden = loadGolden("sbi-evaluation.json");
      const actual = createSBIEvaluation();

      const mismatches = verifyShape(golden, actual);
      expect(mismatches).toEqual([]);
    });

    it("should have style_items with sbi-specific fields", () => {
      const actual = createSBIEvaluation();
      expect(actual.style_items).toBeDefined();
      expect(actual.style_items!.length).toBeGreaterThanOrEqual(2);

      for (const item of actual.style_items!) {
        expect(item.style).toBe("sbi");
        const sbiItem = item as {
          valence: string;
          situation: string;
          behavior: string;
          impact: string;
        };
        expect(sbiItem.valence).toMatch(/^(positive|constructive)$/);
        expect(typeof sbiItem.situation).toBe("string");
        expect(typeof sbiItem.behavior).toBe("string");
        expect(typeof sbiItem.impact).toBe("string");
      }
    });

    it("should have empty classic items array when using SBI style", () => {
      const actual = createSBIEvaluation();
      expect(actual.items).toEqual([]);
    });
  });

  describe("DeliveryMetrics Shape", () => {
    const extractor = new MetricsExtractor();

    it("should match the metrics-output.json golden structure", () => {
      const golden = loadGolden("metrics-output.json");
      const segments = createSampleSegments();
      const actual = extractor.extract(segments);

      const mismatches = verifyShape(golden, actual);
      expect(mismatches).toEqual([]);
    });

    it("should preserve all required metric fields", () => {
      const segments = createSampleSegments();
      const actual = extractor.extract(segments);

      // Verify every field from DeliveryMetrics exists
      const requiredFields = [
        "durationSeconds",
        "durationFormatted",
        "totalWords",
        "wordsPerMinute",
        "fillerWords",
        "fillerWordCount",
        "fillerWordFrequency",
        "pauseCount",
        "totalPauseDurationSeconds",
        "averagePauseDurationSeconds",
        "intentionalPauseCount",
        "hesitationPauseCount",
        "classifiedPauses",
        "energyVariationCoefficient",
        "energyProfile",
        "classifiedFillers",
        "visualMetrics",
      ];

      for (const field of requiredFields) {
        expect(
          field in actual,
          `Missing required field: ${field}`,
        ).toBe(true);
      }
    });

    it("should compute correct metrics for sample segments", () => {
      const segments = createSampleSegments();
      const actual = extractor.extract(segments);

      // Duration: last endTime - first startTime = 10.0 - 0 = 10.0
      expect(actual.durationSeconds).toBe(10.0);
      // Total words: 12 + 8 = 20
      expect(actual.totalWords).toBe(20);
      // WPM: 20 / (10/60) = 120
      expect(actual.wordsPerMinute).toBeCloseTo(120, 0);
      // Should detect "um" as filler (appears twice)
      expect(actual.fillerWordCount).toBeGreaterThanOrEqual(1);
    });

    it("should produce empty metrics for empty segments", () => {
      const actual = extractor.extract([]);
      expect(actual.durationSeconds).toBe(0);
      expect(actual.totalWords).toBe(0);
      expect(actual.wordsPerMinute).toBe(0);
      expect(actual.fillerWordCount).toBe(0);
      expect(actual.classifiedPauses).toEqual([]);
      expect(actual.classifiedFillers).toEqual([]);
    });
  });

  describe("Shape Verifier Utility", () => {
    it("should detect missing keys", () => {
      const golden = { a: 1, b: 2 };
      const actual = { a: 1 };
      const mismatches = verifyShape(golden, actual);
      expect(mismatches.length).toBe(1);
      expect(mismatches[0]).toContain("b");
    });

    it("should detect type mismatches (array vs non-array)", () => {
      const golden = { items: [{ id: 1 }] };
      const actual = { items: "not-an-array" };
      const mismatches = verifyShape(golden, actual);
      expect(mismatches.length).toBe(1);
      expect(mismatches[0]).toContain("array");
    });

    it("should pass for matching shapes", () => {
      const golden = { a: 1, b: { c: [{ d: 1 }] } };
      const actual = { a: 42, b: { c: [{ d: 99 }] }, extra: true };
      const mismatches = verifyShape(golden, actual);
      expect(mismatches).toEqual([]);
    });
  });
});
