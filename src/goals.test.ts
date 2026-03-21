/**
 * Tests for Speaker Goal Setting — goals.ts
 * Issue: #153
 */
import { describe, it, expect, vi } from "vitest";
import { loadGoals, saveGoals, evaluateGoals } from "./goals.js";
import type { SpeakerGoal, GoalEvaluation } from "./goals.js";
import type { GcsHistoryClient, SpeakerProgressEntry } from "./gcs-history.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockClient(overrides: Partial<GcsHistoryClient> = {}): GcsHistoryClient {
  return {
    saveFile: vi.fn(),
    listPrefixes: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue("{}"),
    getSignedReadUrl: vi.fn().mockResolvedValue("https://example.com"),
    fileExists: vi.fn().mockResolvedValue(false),
    deletePrefix: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeGoal(overrides: Partial<SpeakerGoal> = {}): SpeakerGoal {
  return {
    id: "test-1",
    metric: "wpm",
    direction: "between",
    target: 130,
    targetHigh: 160,
    created: "2026-03-21T12:00:00Z",
    ...overrides,
  };
}

function makeProgress(overrides: Partial<SpeakerProgressEntry> = {}): SpeakerProgressEntry {
  return {
    date: "2026-03-21",
    speechTitle: "Test Speech",
    wordsPerMinute: 145,
    passRate: 80,
    durationSeconds: 300,
    fillerWordFrequency: 2.5,
    ...overrides,
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────────────────

describe("goals CRUD", () => {
  it("loadGoals returns empty array when no goals file exists", async () => {
    const client = mockClient({ fileExists: vi.fn().mockResolvedValue(false) });
    const goals = await loadGoals(client, "alice");
    expect(goals).toEqual([]);
    expect(client.fileExists).toHaveBeenCalledWith("results/alice/goals.json");
  });

  it("loadGoals reads and parses goals file from GCS", async () => {
    const storedGoals = [makeGoal()];
    const client = mockClient({
      fileExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue(JSON.stringify({ goals: storedGoals })),
    });
    const goals = await loadGoals(client, "alice");
    expect(goals).toEqual(storedGoals);
    expect(client.readFile).toHaveBeenCalledWith("results/alice/goals.json");
  });

  it("saveGoals writes goals to GCS as JSON", async () => {
    const client = mockClient();
    const goals = [makeGoal()];
    await saveGoals(client, "alice", goals);
    expect(client.saveFile).toHaveBeenCalledWith(
      "results/alice/goals.json",
      expect.stringContaining('"goals"'),
      "application/json",
    );
  });
});

// ─── Evaluation ─────────────────────────────────────────────────────────────────

describe("evaluateGoals", () => {
  describe("WPM goals", () => {
    it("WPM between 130-160: met when value is in range", () => {
      const goals = [makeGoal({ metric: "wpm", direction: "between", target: 130, targetHigh: 160 })];
      const progress = [makeProgress({ wordsPerMinute: 145 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(true);
      expect(result[0].currentValue).toBe(145);
      expect(result[0].delta).toBe(0);
    });

    it("WPM between 130-160: not met when too slow", () => {
      const goals = [makeGoal({ metric: "wpm", direction: "between", target: 130, targetHigh: 160 })];
      const progress = [makeProgress({ wordsPerMinute: 110 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(false);
      expect(result[0].currentValue).toBe(110);
    });

    it("WPM between 130-160: not met when too fast", () => {
      const goals = [makeGoal({ metric: "wpm", direction: "between", target: 130, targetHigh: 160 })];
      const progress = [makeProgress({ wordsPerMinute: 180 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(false);
    });

    it("WPM above: met when value exceeds target", () => {
      const goals = [makeGoal({ metric: "wpm", direction: "above", target: 120 })];
      const progress = [makeProgress({ wordsPerMinute: 145 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(true);
      expect(result[0].delta).toBe(25);
    });

    it("WPM above: not met when below target", () => {
      const goals = [makeGoal({ metric: "wpm", direction: "above", target: 150 })];
      const progress = [makeProgress({ wordsPerMinute: 130 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(false);
      expect(result[0].delta).toBe(-20);
    });
  });

  describe("filler frequency goals", () => {
    it("filler below 2/min: met when below", () => {
      const goals = [makeGoal({ metric: "filler_frequency", direction: "below", target: 2 })];
      const progress = [makeProgress({ fillerWordFrequency: 1.5 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(true);
      expect(result[0].delta).toBe(0.5);
    });

    it("filler below 2/min: not met when above", () => {
      const goals = [makeGoal({ metric: "filler_frequency", direction: "below", target: 2 })];
      const progress = [makeProgress({ fillerWordFrequency: 3.5 })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].met).toBe(false);
      expect(result[0].delta).toBe(-1.5);
    });

    it("filler frequency: null when not available in progress", () => {
      const goals = [makeGoal({ metric: "filler_frequency", direction: "below", target: 2 })];
      const progress = [makeProgress({ fillerWordFrequency: undefined })];
      const result = evaluateGoals(goals, progress);
      expect(result[0].currentValue).toBe(null);
      expect(result[0].met).toBe(false);
    });
  });

  describe("category score goals", () => {
    it("category above 7: met when score is high enough", () => {
      const goals = [makeGoal({ metric: "category_score", direction: "above", target: 7, category: "delivery" })];
      const progress = [makeProgress()];
      const categoryScores = [{ category: "delivery", score: 8 }];
      const result = evaluateGoals(goals, progress, categoryScores);
      expect(result[0].met).toBe(true);
      expect(result[0].currentValue).toBe(8);
    });

    it("category above 7: not met when score is low", () => {
      const goals = [makeGoal({ metric: "category_score", direction: "above", target: 7, category: "content" })];
      const progress = [makeProgress()];
      const categoryScores = [{ category: "content", score: 5 }];
      const result = evaluateGoals(goals, progress, categoryScores);
      expect(result[0].met).toBe(false);
      expect(result[0].delta).toBe(-2);
    });

    it("category score: null when category not found", () => {
      const goals = [makeGoal({ metric: "category_score", direction: "above", target: 7, category: "structure" })];
      const progress = [makeProgress()];
      const categoryScores = [{ category: "delivery", score: 8 }];
      const result = evaluateGoals(goals, progress, categoryScores);
      expect(result[0].currentValue).toBe(null);
    });
  });

  describe("edge cases", () => {
    it("empty progress returns null values", () => {
      const goals = [makeGoal()];
      const result = evaluateGoals(goals, []);
      expect(result[0].currentValue).toBe(null);
      expect(result[0].met).toBe(false);
    });

    it("multiple goals evaluated independently", () => {
      const goals = [
        makeGoal({ id: "g1", metric: "wpm", direction: "between", target: 130, targetHigh: 160 }),
        makeGoal({ id: "g2", metric: "filler_frequency", direction: "below", target: 2 }),
      ];
      const progress = [makeProgress({ wordsPerMinute: 145, fillerWordFrequency: 3.0 })];
      const result = evaluateGoals(goals, progress);
      expect(result).toHaveLength(2);
      expect(result[0].met).toBe(true);  // WPM in range
      expect(result[1].met).toBe(false); // fillers too high
    });

    it("uses latest progress entry for evaluation", () => {
      const goals = [makeGoal({ metric: "wpm", direction: "above", target: 140 })];
      const progress = [
        makeProgress({ wordsPerMinute: 100 }),
        makeProgress({ wordsPerMinute: 120 }),
        makeProgress({ wordsPerMinute: 150 }), // latest
      ];
      const result = evaluateGoals(goals, progress);
      expect(result[0].currentValue).toBe(150);
      expect(result[0].met).toBe(true);
    });
  });
});
