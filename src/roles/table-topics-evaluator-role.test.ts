/**
 * Tests for Table Topics Evaluator role.
 * Issue: #77
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { TableTopicsEvaluatorRole } from "./table-topics-evaluator-role.js";
import type { RoleContext, ReportSection } from "../meeting-role.js";
import type { DeliveryMetrics } from "../types.js";

const MOCK_RESPONSE = JSON.stringify({
  relevance: { score: 8, feedback: "Strong connection to the given topic" },
  structure: { score: 7, feedback: "Clear opening and body, conclusion could be stronger" },
  confidence: { score: 9, feedback: "Spoke with conviction and minimal hesitation" },
  timeManagement: { score: 6, feedback: "Slightly under the 1-minute target" },
  overallFeedback: "A confident and relevant response. Structure was good with room for a stronger close.",
  strengths: ["Immediate engagement with the topic", "Strong vocal presence"],
  areasForGrowth: ["Develop a clear concluding statement", "Aim for the full 1-2 minute window"],
});

function makeLLM(response: string = MOCK_RESPONSE) {
  return vi.fn().mockResolvedValue(response);
}

function makeMetrics(overrides: Partial<DeliveryMetrics> = {}): DeliveryMetrics {
  return {
    durationSeconds: 75, durationFormatted: "1:15", totalWords: 150, wordsPerMinute: 120,
    fillerWords: [], fillerWordCount: 0, fillerWordFrequency: 0,
    pauseCount: 0, totalPauseDurationSeconds: 0, averagePauseDurationSeconds: 0,
    intentionalPauseCount: 0, hesitationPauseCount: 0, classifiedPauses: [],
    energyVariationCoefficient: 0.3, energyProfile: { windowDurationMs: 500, windows: [], coefficientOfVariation: 0.3, silenceThreshold: 0.01 },
    classifiedFillers: [], visualMetrics: null, ...overrides,
  };
}

function makeContext(config: Record<string, unknown> = {}): RoleContext {
  return {
    transcript: [
      { text: "Well, if I could visit any event, I'd choose the moon landing.", startTime: 0, endTime: 30, words: [], isFinal: true },
      { text: "Imagine witnessing that moment of human achievement firsthand.", startTime: 30, endTime: 60, words: [], isFinal: true },
    ],
    metrics: makeMetrics(),
    visualObservations: null, projectContext: null, consent: null,
    speakerName: "Charlie",
    config: { llmCall: makeLLM(), ...config },
  };
}

describe("TableTopicsEvaluatorRole", () => {
  const role = new TableTopicsEvaluatorRole();

  it("has correct metadata", () => {
    expect(role.id).toBe("table-topics-evaluator");
    expect(role.name).toBe("Table Topics Evaluator");
    expect(role.requiredInputs).toContain("transcript");
  });

  it("throws when transcript is empty", async () => {
    await expect(role.run({ ...makeContext(), transcript: [] })).rejects.toThrow("transcript");
  });

  it("throws when no llmCall in config", async () => {
    await expect(role.run({ ...makeContext(), config: {} })).rejects.toThrow("llmCall");
  });

  it("produces scored report", async () => {
    const result = await role.run(makeContext());
    expect(result.report.title).toBe("Table Topics Evaluation");
    const scoresSection = result.report.sections.find((s: ReportSection) => s.heading === "Scores");
    expect(scoresSection).toBeDefined();
    expect(scoresSection!.content).toContain("Relevance: 8/10");
  });

  it("includes average score in data", async () => {
    const result = await role.run(makeContext());
    expect(result.report.data?.averageScore).toBe(7.5);
  });

  it("produces script mentioning speaker name", async () => {
    const result = await role.run(makeContext());
    expect(result.script).toContain("Charlie");
  });

  it("passes topic question to LLM", async () => {
    const llm = makeLLM();
    await role.run(makeContext({ llmCall: llm, topicQuestion: "What inspires you?" }));
    const prompt = (llm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("What inspires you?");
  });

  it("falls back on LLM failure", async () => {
    const bad = vi.fn().mockRejectedValue(new Error("fail"));
    const result = await role.run(makeContext({ llmCall: bad }));
    expect(result.report.data?.error).toBe(true);
  });

  describe("property tests", () => {
    it("roleId is always 'table-topics-evaluator'", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 5 }), async (text) => {
          const ctx = makeContext();
          ctx.transcript = [{ text, startTime: 0, endTime: 5, words: [], isFinal: true }];
          const result = await role.run(ctx);
          expect(result.roleId).toBe("table-topics-evaluator");
        }),
        { numRuns: 5 },
      );
    });
  });
});
