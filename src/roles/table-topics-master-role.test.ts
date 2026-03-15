/**
 * Tests for Table Topics Master role.
 * Issue: #76
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { TableTopicsMasterRole } from "./table-topics-master-role.js";
import type { RoleContext } from "../meeting-role.js";
import type { DeliveryMetrics } from "../types.js";

const MOCK_RESPONSE = JSON.stringify({
  theme: "Time Travel",
  prompts: [
    { topic: "If you could visit any historical event, which would it be?", context: "Consider the impact on your perspective", suggestedTimeMinutes: 1.5 },
    { topic: "What would you tell your younger self?", context: "Think about pivotal life moments", suggestedTimeMinutes: 1 },
  ],
  introScript: "Welcome to Table Topics! Today we're exploring the theme of Time Travel. Let your imagination run wild!",
});

function makeLLM(response: string = MOCK_RESPONSE) {
  return vi.fn().mockResolvedValue(response);
}

function makeMetrics(): DeliveryMetrics {
  return {
    durationSeconds: 0, durationFormatted: "0:00", totalWords: 0, wordsPerMinute: 0,
    fillerWords: [], fillerWordCount: 0, fillerWordFrequency: 0,
    pauseCount: 0, totalPauseDurationSeconds: 0, averagePauseDurationSeconds: 0,
    intentionalPauseCount: 0, hesitationPauseCount: 0, classifiedPauses: [],
    energyVariationCoefficient: 0, energyProfile: { windowDurationMs: 500, windows: [], coefficientOfVariation: 0, silenceThreshold: 0.01 },
    classifiedFillers: [], visualMetrics: null,
  };
}

function makeContext(config: Record<string, unknown> = {}): RoleContext {
  return {
    transcript: [], metrics: makeMetrics(), visualObservations: null,
    projectContext: null, consent: null, speakerName: null,
    config: { llmCall: makeLLM(), ...config },
  };
}

describe("TableTopicsMasterRole", () => {
  const role = new TableTopicsMasterRole();

  it("has correct metadata", () => {
    expect(role.id).toBe("table-topics-master");
    expect(role.name).toBe("Table Topics Master");
    expect(role.requiredInputs).toEqual([]);
  });

  it("throws when no llmCall in config", async () => {
    await expect(role.run(makeContext({ llmCall: undefined }))).rejects.toThrow("llmCall");
  });

  it("produces a report with theme and topics", async () => {
    const result = await role.run(makeContext());
    expect(result.report.title).toBe("Table Topics");
    expect(result.report.sections.length).toBeGreaterThanOrEqual(2);
    expect(result.report.data?.theme).toBe("Time Travel");
    expect(result.report.data?.promptCount).toBe(2);
  });

  it("produces a non-empty script", async () => {
    const result = await role.run(makeContext());
    expect(result.script.length).toBeGreaterThan(0);
    expect(result.script).toContain("Time Travel");
  });

  it("passes theme to LLM prompt", async () => {
    const llm = makeLLM();
    await role.run(makeContext({ llmCall: llm, theme: "Leadership" }));
    const prompt = (llm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("Leadership");
  });

  it("falls back gracefully on LLM failure", async () => {
    const badLLM = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await role.run(makeContext({ llmCall: badLLM }));
    expect(result.report.title).toBe("Table Topics");
    expect(result.report.data?.error).toBe(true);
  });

  it("falls back on invalid JSON", async () => {
    const badLLM = vi.fn().mockResolvedValue("not json");
    const result = await role.run(makeContext({ llmCall: badLLM }));
    expect(result.report.data?.error).toBe(true);
  });

  describe("property tests", () => {
    it("roleId is always 'table-topics-master'", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async () => {
          const result = await role.run(makeContext());
          expect(result.roleId).toBe("table-topics-master");
        }),
        { numRuns: 5 },
      );
    });
  });
});
