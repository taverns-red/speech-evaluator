/**
 * Tests for the AI Grammarian role — LLM-based grammar analysis.
 * Issue: #75
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { GrammarianRole, type LLMCallFn } from "./grammarian-role.js";
import type { RoleContext } from "../meeting-role.js";
import type { DeliveryMetrics } from "../types.js";

// ─── Test Helpers ───────────────────────────────────────────────────────────────

const MOCK_LLM_RESPONSE = JSON.stringify({
  grammarNotes: [
    { issue: "Subject-verb disagreement", example: "The team were ready", suggestion: "The team was ready" },
    { issue: "Tense shift", example: "I walked in and sit down", suggestion: "I walked in and sat down" },
  ],
  vocabularyHighlights: [
    "Excellent use of 'juxtaposition' to contrast ideas",
    "The phrase 'catalyze change' was particularly effective",
  ],
  overallImpression: "Generally strong grammar with a few minor tense inconsistencies. Vocabulary was impressive.",
  recommendations: [
    "Watch for tense consistency in narrative sections",
    "Continue using sophisticated vocabulary — it enhances credibility",
  ],
});

function makeMockLLM(response: string = MOCK_LLM_RESPONSE): LLMCallFn {
  return vi.fn().mockResolvedValue(response);
}

function makeMetrics(overrides: Partial<DeliveryMetrics> = {}): DeliveryMetrics {
  return {
    durationSeconds: 420,
    durationFormatted: "7:00",
    totalWords: 980,
    wordsPerMinute: 140,
    fillerWords: [],
    fillerWordCount: 0,
    fillerWordFrequency: 0,
    pauseCount: 0,
    totalPauseDurationSeconds: 0,
    averagePauseDurationSeconds: 0,
    intentionalPauseCount: 0,
    hesitationPauseCount: 0,
    classifiedPauses: [],
    energyVariationCoefficient: 0.3,
    energyProfile: { windowDurationMs: 500, windows: [], coefficientOfVariation: 0.3, silenceThreshold: 0.01 },
    classifiedFillers: [],
    visualMetrics: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RoleContext> = {}, llm?: LLMCallFn): RoleContext {
  return {
    transcript: [
      { text: "The team were ready to begin. I walked in and sit down.", startTime: 0, endTime: 10, words: [], isFinal: true },
      { text: "This juxtaposition shows how we can catalyze change.", startTime: 10, endTime: 20, words: [], isFinal: true },
    ],
    metrics: makeMetrics(),
    visualObservations: null,
    projectContext: null,
    consent: null,
    speakerName: "Alice",
    config: { llmCall: llm ?? makeMockLLM() },
    ...overrides,
  };
}

// ─── Unit Tests ─────────────────────────────────────────────────────────────────

describe("GrammarianRole", () => {
  const role = new GrammarianRole();

  it("has correct metadata", () => {
    expect(role.id).toBe("grammarian");
    expect(role.name).toBe("Grammarian");
    expect(role.requiredInputs).toContain("transcript");
  });

  it("throws when transcript is empty", async () => {
    await expect(role.run(makeContext({ transcript: [] }))).rejects.toThrow("transcript");
  });

  it("throws when no llmCall in config", async () => {
    await expect(role.run(makeContext({ config: {} }))).rejects.toThrow("llmCall");
  });

  // ─── LLM Integration ───────────────────────────────────────────────────

  describe("LLM integration", () => {
    it("calls the LLM with a prompt containing the transcript", async () => {
      const llm = makeMockLLM();
      await role.run(makeContext({}, llm));
      expect(llm).toHaveBeenCalledOnce();
      const prompt = (llm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(prompt).toContain("team were ready");
    });

    it("includes word of the day in prompt when configured", async () => {
      const llm = makeMockLLM();
      await role.run(makeContext({ config: { llmCall: llm, wordOfTheDay: "juxtaposition" } }));
      const prompt = (llm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(prompt).toContain("juxtaposition");
    });
  });

  // ─── Report Structure ───────────────────────────────────────────────────

  describe("report structure", () => {
    it("produces a titled report with sections", async () => {
      const result = await role.run(makeContext());
      expect(result.report.title).toBe("Grammarian Report");
      expect(result.report.sections.length).toBeGreaterThanOrEqual(2);
    });

    it("includes grammar notes section", async () => {
      const result = await role.run(makeContext());
      const section = result.report.sections.find(s => s.heading === "Grammar Notes");
      expect(section).toBeDefined();
      expect(section!.content).toContain("Subject-verb");
    });

    it("includes vocabulary highlights section", async () => {
      const result = await role.run(makeContext());
      const section = result.report.sections.find(s => s.heading === "Vocabulary Highlights");
      expect(section).toBeDefined();
      expect(section!.content).toContain("juxtaposition");
    });

    it("includes recommendations section", async () => {
      const result = await role.run(makeContext());
      const section = result.report.sections.find(s => s.heading === "Recommendations");
      expect(section).toBeDefined();
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
  });

  // ─── LLM Failure Fallback ──────────────────────────────────────────────

  describe("LLM failure handling", () => {
    it("returns a fallback report when LLM returns invalid JSON", async () => {
      const badLLM = vi.fn().mockResolvedValue("This is not valid JSON at all");
      const result = await role.run(makeContext({ config: { llmCall: badLLM } }));
      expect(result.report.title).toBe("Grammarian Report");
      expect(result.report.sections.some(s => s.content.includes("unavailable"))).toBe(true);
    });

    it("returns a fallback report when LLM throws", async () => {
      const throwingLLM = vi.fn().mockRejectedValue(new Error("LLM timeout"));
      const result = await role.run(makeContext({ config: { llmCall: throwingLLM } }));
      expect(result.report.title).toBe("Grammarian Report");
      expect(result.report.sections.some(s => s.content.includes("unavailable"))).toBe(true);
    });
  });

  // ─── Word of the Day ───────────────────────────────────────────────────

  describe("word of the day", () => {
    it("includes WotD count in report data", async () => {
      const result = await role.run(makeContext({
        config: { llmCall: makeMockLLM(), wordOfTheDay: "juxtaposition" },
      }));
      expect(result.report.data?.wordOfTheDayCount).toBeDefined();
    });
  });

  // ─── Property-Based Tests ──────────────────────────────────────────────

  describe("property tests", () => {
    it("roleId is always 'grammarian'", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          async (texts) => {
            const transcript = texts.map((t, i) => ({
              text: t,
              startTime: i * 5,
              endTime: (i + 1) * 5,
              words: [],
              isFinal: true,
            }));
            const result = await role.run(makeContext({ transcript }));
            expect(result.roleId).toBe("grammarian");
          },
        ),
        { numRuns: 10 },
      );
    });

    it("always produces a report with sections", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5 }),
          async (text) => {
            const result = await role.run(makeContext({
              transcript: [{ text, startTime: 0, endTime: 5, words: [], isFinal: true }],
            }));
            expect(result.report.sections.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 10 },
      );
    });
  });
});
