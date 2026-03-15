/**
 * AhCounterRole Tests — verifies filler word reporting and script rendering.
 * Issue: #73
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { AhCounterRole, countWordOfTheDay } from "./ah-counter-role.js";
import type { RoleContext } from "../meeting-role.js";
import type { DeliveryMetrics, FillerWordEntry, ClassifiedFillerEntry, TranscriptSegment } from "../types.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<DeliveryMetrics> = {}): DeliveryMetrics {
  return {
    durationSeconds: 120,
    durationFormatted: "2:00",
    totalWords: 200,
    wordsPerMinute: 100,
    fillerWords: overrides.fillerWords ?? [],
    fillerWordCount: overrides.fillerWordCount ?? 0,
    fillerWordFrequency: overrides.fillerWordFrequency ?? 0,
    pauseCount: 0,
    totalPauseDurationSeconds: 0,
    averagePauseDurationSeconds: 0,
    intentionalPauseCount: 0,
    hesitationPauseCount: 0,
    classifiedPauses: [],
    energyVariationCoefficient: 0,
    energyProfile: {
      windowDurationMs: 500,
      windows: [],
      coefficientOfVariation: 0,
      silenceThreshold: 0,
    },
    classifiedFillers: overrides.classifiedFillers ?? [],
    visualMetrics: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RoleContext> = {}): RoleContext {
  return {
    transcript: overrides.transcript ?? [
      { text: "Hello world", startTime: 0, endTime: 2, words: [], isFinal: true },
    ],
    metrics: "metrics" in overrides ? overrides.metrics ?? null : makeMetrics(),
    visualObservations: null,
    projectContext: null,
    consent: null,
    speakerName: overrides.speakerName ?? null,
    config: overrides.config ?? {},
  };
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("AhCounterRole", () => {
  const role = new AhCounterRole();

  it("has correct identity", () => {
    expect(role.id).toBe("ah-counter");
    expect(role.name).toBe("Ah-Counter");
    expect(role.requiredInputs).toEqual(["transcript", "metrics"]);
  });

  it("produces a report for zero fillers", async () => {
    const result = await role.run(makeContext());

    expect(result.roleId).toBe("ah-counter");
    expect(result.report.title).toBe("Ah-Counter Report");
    expect(result.script).toContain("no filler words");
    expect(result.report.data?.fillerWordCount).toBe(0);
  });

  it("produces a report with filler word breakdown", async () => {
    const fillerWords: FillerWordEntry[] = [
      { word: "um", count: 5, timestamps: [10, 25, 40, 55, 70] },
      { word: "uh", count: 3, timestamps: [12, 45, 60] },
    ];
    const classifiedFillers: ClassifiedFillerEntry[] = [
      { word: "um", count: 5, timestamps: [10, 25, 40, 55, 70], classification: "true_filler" },
      { word: "uh", count: 3, timestamps: [12, 45, 60], classification: "true_filler" },
    ];

    const context = makeContext({
      metrics: makeMetrics({
        fillerWords,
        classifiedFillers,
        fillerWordCount: 8,
        fillerWordFrequency: 4.0,
      }),
    });

    const result = await role.run(context);

    // Report structure
    expect(result.report.sections.length).toBeGreaterThanOrEqual(2);
    expect(result.report.sections.some((s) => s.heading === "Summary")).toBe(true);
    expect(result.report.sections.some((s) => s.heading === "Filler Word Breakdown")).toBe(true);

    // Data payload
    expect(result.report.data?.fillerWordCount).toBe(8);
    expect(result.report.data?.trueFillerCount).toBe(8);

    // Script content
    expect(result.script).toContain("8 filler words");
    expect(result.script).toContain("4.0 per minute");
    expect(result.script).toContain('"um"');
    expect(result.script).toContain('"uh"');
  });

  it("distinguishes true fillers from discourse markers", async () => {
    const classifiedFillers: ClassifiedFillerEntry[] = [
      { word: "um", count: 3, timestamps: [10, 20, 30], classification: "true_filler" },
      { word: "you know", count: 2, timestamps: [15, 25], classification: "discourse_marker" },
    ];

    const context = makeContext({
      metrics: makeMetrics({
        fillerWords: [
          { word: "um", count: 3, timestamps: [10, 20, 30] },
          { word: "you know", count: 2, timestamps: [15, 25] },
        ],
        classifiedFillers,
        fillerWordCount: 5,
        fillerWordFrequency: 2.5,
      }),
    });

    const result = await role.run(context);

    expect(result.report.data?.trueFillerCount).toBe(3);
    expect(result.report.data?.discourseMarkerCount).toBe(2);
    expect(result.script).toContain("true filler");
    expect(result.script).toContain("discourse marker");
  });

  it("includes speaker name when available", async () => {
    const context = makeContext({ speakerName: "Alice" });

    const result = await role.run(context);

    expect(result.script).toContain("Alice");
  });

  it("falls back to 'the speaker' without a name", async () => {
    const context = makeContext({ speakerName: null });

    const result = await role.run(context);

    expect(result.script).toContain("the speaker");
  });

  it("throws when metrics is null", async () => {
    const context = makeContext({ metrics: null });

    await expect(role.run(context)).rejects.toThrowError(/requires metrics data/);
  });
});

describe("Word of the Day", () => {
  const role = new AhCounterRole();

  it("tracks Word of the Day usage", async () => {
    const context = makeContext({
      transcript: [
        { text: "Today I want to talk about innovation and how innovation drives growth", startTime: 0, endTime: 10, words: [], isFinal: true },
      ],
      config: { wordOfTheDay: "innovation" },
    });

    const result = await role.run(context);

    expect(result.report.sections.some((s) => s.heading === "Word of the Day")).toBe(true);
    expect(result.report.data?.wordOfTheDayCount).toBe(2);
    expect(result.script).toContain('"innovation"');
    expect(result.script).toContain("2 times");
  });

  it("reports zero usage for absent Word of the Day", async () => {
    const context = makeContext({
      transcript: [
        { text: "Hello world", startTime: 0, endTime: 2, words: [], isFinal: true },
      ],
      config: { wordOfTheDay: "serendipity" },
    });

    const result = await role.run(context);

    expect(result.report.data?.wordOfTheDayCount).toBe(0);
    expect(result.script).toContain("didn't catch");
  });

  it("is case-insensitive", () => {
    const segments: TranscriptSegment[] = [
      { text: "Innovation is key. INNOVATION drives progress.", startTime: 0, endTime: 5, words: [], isFinal: true },
    ];
    expect(countWordOfTheDay("innovation", segments)).toBe(2);
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("AhCounterRole property tests", () => {
  const role = new AhCounterRole();

  it("report filler count always matches sum of individual word counts", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            word: fc.constantFrom("um", "uh", "like", "so", "you know"),
            count: fc.integer({ min: 1, max: 20 }),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        async (entries) => {
          const fillerWords: FillerWordEntry[] = entries.map((e) => ({
            word: e.word,
            count: e.count,
            timestamps: Array.from({ length: e.count }, (_, i) => i * 5),
          }));
          const total = fillerWords.reduce((sum, fw) => sum + fw.count, 0);

          const context = makeContext({
            metrics: makeMetrics({
              fillerWords,
              fillerWordCount: total,
              fillerWordFrequency: total / 2,
              classifiedFillers: fillerWords.map((fw) => ({
                ...fw,
                classification: "true_filler" as const,
              })),
            }),
          });

          const result = await role.run(context);
          expect(result.report.data?.fillerWordCount).toBe(total);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("script is always a non-empty string", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 30 }),
        async (fillerCount) => {
          const context = makeContext({
            metrics: makeMetrics({
              fillerWordCount: fillerCount,
              fillerWordFrequency: fillerCount / 2,
              fillerWords: fillerCount > 0
                ? [{ word: "um", count: fillerCount, timestamps: Array.from({ length: fillerCount }, (_, i) => i) }]
                : [],
              classifiedFillers: fillerCount > 0
                ? [{ word: "um", count: fillerCount, timestamps: Array.from({ length: fillerCount }, (_, i) => i), classification: "true_filler" as const }]
                : [],
            }),
          });

          const result = await role.run(context);
          expect(result.script).toBeTruthy();
          expect(result.script.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

