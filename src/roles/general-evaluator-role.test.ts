/**
 * Tests for General Evaluator role.
 * Issue: #78
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { GeneralEvaluatorRole } from "./general-evaluator-role.js";
import type { RoleContext, ReportSection } from "../meeting-role.js";
import type { DeliveryMetrics } from "../types.js";

const MOCK_RESPONSE = JSON.stringify({
  meetingSummary: "A well-organized meeting with strong participation from all members.",
  highlights: ["The prepared speech on leadership was exceptionally structured", "Table Topics responses showed great creativity"],
  areasForImprovement: ["Time management could be tighter between segments", "More use of the podium microphone"],
  rolePerformanceSummary: "Role-holders were well prepared and delivered concise reports.",
  recommendations: ["Consider a themed meeting next week", "Practice transitions between speakers"],
  closingRemarks: "Great energy today — keep it up!",
});

function makeLLM(response: string = MOCK_RESPONSE) {
  return vi.fn().mockResolvedValue(response);
}

function makeMetrics(): DeliveryMetrics {
  return {
    durationSeconds: 3600, durationFormatted: "60:00", totalWords: 5000, wordsPerMinute: 130,
    fillerWords: [], fillerWordCount: 0, fillerWordFrequency: 0,
    pauseCount: 0, totalPauseDurationSeconds: 0, averagePauseDurationSeconds: 0,
    intentionalPauseCount: 0, hesitationPauseCount: 0, classifiedPauses: [],
    energyVariationCoefficient: 0.3, energyProfile: { windowDurationMs: 500, windows: [], coefficientOfVariation: 0.3, silenceThreshold: 0.01 },
    classifiedFillers: [], visualMetrics: null,
  };
}

function makeContext(config: Record<string, unknown> = {}): RoleContext {
  return {
    transcript: [
      { text: "Welcome everyone to today's meeting.", startTime: 0, endTime: 5, words: [], isFinal: true },
      { text: "Our first speaker will present on leadership.", startTime: 5, endTime: 10, words: [], isFinal: true },
    ],
    metrics: makeMetrics(),
    visualObservations: null, projectContext: null, consent: null,
    speakerName: null,
    config: { llmCall: makeLLM(), ...config },
  };
}

describe("GeneralEvaluatorRole", () => {
  const role = new GeneralEvaluatorRole();

  it("has correct metadata", () => {
    expect(role.id).toBe("general-evaluator");
    expect(role.name).toBe("General Evaluator");
    expect(role.requiredInputs).toContain("transcript");
  });

  it("throws when transcript is empty", async () => {
    await expect(role.run({ ...makeContext(), transcript: [] })).rejects.toThrow("transcript");
  });

  it("throws when no llmCall in config", async () => {
    await expect(role.run({ ...makeContext(), config: {} })).rejects.toThrow("llmCall");
  });

  it("produces report with meeting summary", async () => {
    const result = await role.run(makeContext());
    expect(result.report.title).toBe("General Evaluator Report");
    const summary = result.report.sections.find((s: ReportSection) => s.heading === "Meeting Summary");
    expect(summary).toBeDefined();
    expect(summary!.content).toContain("well-organized");
  });

  it("includes highlights section", async () => {
    const result = await role.run(makeContext());
    const highlights = result.report.sections.find((s: ReportSection) => s.heading === "Highlights");
    expect(highlights).toBeDefined();
    expect(highlights!.content).toContain("leadership");
  });

  it("includes recommendations section", async () => {
    const result = await role.run(makeContext());
    const recs = result.report.sections.find((s: ReportSection) => s.heading === "Recommendations");
    expect(recs).toBeDefined();
  });

  it("includes highlight count in data", async () => {
    const result = await role.run(makeContext());
    expect(result.report.data?.highlightCount).toBe(2);
  });

  it("produces a non-empty script", async () => {
    const result = await role.run(makeContext());
    expect(result.script).toContain("General Evaluator");
    expect(result.script.length).toBeGreaterThan(0);
  });

  it("passes roleResults to LLM prompt", async () => {
    const llm = makeLLM();
    const roleResults = [{ roleId: "ah-counter", report: { title: "Ah-Counter", sections: [{ heading: "Summary", content: "5 filler words" }] } }];
    await role.run(makeContext({ llmCall: llm, roleResults }));
    const prompt = (llm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("Ah-Counter");
    expect(prompt).toContain("5 filler words");
  });

  it("falls back on LLM failure", async () => {
    const bad = vi.fn().mockRejectedValue(new Error("fail"));
    const result = await role.run(makeContext({ llmCall: bad }));
    expect(result.report.data?.error).toBe(true);
  });

  describe("property tests", () => {
    it("roleId is always 'general-evaluator'", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 5 }), async (text) => {
          const ctx = makeContext();
          ctx.transcript = [{ text, startTime: 0, endTime: 5, words: [], isFinal: true }];
          const result = await role.run(ctx);
          expect(result.roleId).toBe("general-evaluator");
        }),
        { numRuns: 5 },
      );
    });
  });
});
