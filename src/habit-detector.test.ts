/**
 * Tests for habit-detector.ts — habit and breakthrough detection logic.
 *
 * Phase 8 — #147
 */

import { describe, it, expect } from "vitest";
import {
  detectHabits,
  detectBreakthroughs,
  type HabitItem,
} from "./habit-detector.js";
import type { CategoryScore } from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeScores(overrides: Partial<Record<string, number>> = {}): CategoryScore[] {
  return [
    { category: "delivery", score: overrides.delivery ?? 7, rationale: "OK" },
    { category: "content", score: overrides.content ?? 7, rationale: "OK" },
    { category: "structure", score: overrides.structure ?? 7, rationale: "OK" },
    { category: "engagement", score: overrides.engagement ?? 7, rationale: "OK" },
  ];
}

// ─── detectHabits ───────────────────────────────────────────────────────────────

describe("detectHabits", () => {
  it("should detect habit when category scores ≤5 for 3+ consecutive recent speeches", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 4 }),
      makeScores({ delivery: 3 }),
      makeScores({ delivery: 5 }),
    ];

    const habits = detectHabits(evals);
    expect(habits).toHaveLength(1);
    expect(habits[0].category).toBe("delivery");
    expect(habits[0].speechCount).toBe(3);
    expect(habits[0].averageScore).toBe(4);
  });

  it("should not detect habit when streak is broken", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 3 }),
      makeScores({ delivery: 6 }), // breaks streak
      makeScores({ delivery: 4 }),
      makeScores({ delivery: 5 }),
    ];

    const habits = detectHabits(evals);
    // Only 2 consecutive from the end, below minimum of 3
    expect(habits).toHaveLength(0);
  });

  it("should detect multiple habits", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 3, structure: 4 }),
      makeScores({ delivery: 4, structure: 3 }),
      makeScores({ delivery: 5, structure: 5 }),
    ];

    const habits = detectHabits(evals);
    expect(habits).toHaveLength(2);
    const categories = habits.map(h => h.category);
    expect(categories).toContain("delivery");
    expect(categories).toContain("structure");
  });

  it("should not detect habit with fewer than 3 evaluations", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 3 }),
      makeScores({ delivery: 4 }),
    ];

    expect(detectHabits(evals)).toHaveLength(0);
  });

  it("should handle empty input", () => {
    expect(detectHabits([])).toEqual([]);
  });

  it("should not count scores > 5 as habits", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 6 }),
      makeScores({ delivery: 6 }),
      makeScores({ delivery: 6 }),
    ];

    expect(detectHabits(evals)).toHaveLength(0);
  });

  it("should detect longer streaks", () => {
    const evals: CategoryScore[][] = [
      makeScores({ content: 3 }),
      makeScores({ content: 4 }),
      makeScores({ content: 2 }),
      makeScores({ content: 5 }),
      makeScores({ content: 4 }),
    ];

    const habits = detectHabits(evals);
    expect(habits).toHaveLength(1);
    expect(habits[0].category).toBe("content");
    expect(habits[0].speechCount).toBe(5);
  });

  it("should skip categories missing from some evaluations", () => {
    const evals: CategoryScore[][] = [
      [{ category: "delivery", score: 3, rationale: "low" }],
      [{ category: "delivery", score: 4, rationale: "low" }],
      [{ category: "delivery", score: 5, rationale: "low" }],
    ];

    const habits = detectHabits(evals);
    expect(habits).toHaveLength(1);
    expect(habits[0].category).toBe("delivery");
  });
});

// ─── detectBreakthroughs ────────────────────────────────────────────────────────

describe("detectBreakthroughs", () => {
  it("should detect breakthrough when category gained ≥2 points", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 4 }),
      makeScores({ delivery: 5 }),
      makeScores({ delivery: 7 }),
    ];

    const breakthroughs = detectBreakthroughs(evals);
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].category).toBe("delivery");
    expect(breakthroughs[0].speechCount).toBe(3);
  });

  it("should not detect breakthrough with gain < 2", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 5 }),
      makeScores({ delivery: 6 }),
    ];

    expect(detectBreakthroughs(evals)).toHaveLength(0);
  });

  it("should not detect breakthrough when score declined", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 8 }),
      makeScores({ delivery: 6 }),
      makeScores({ delivery: 5 }),
    ];

    expect(detectBreakthroughs(evals)).toHaveLength(0);
  });

  it("should detect multiple breakthroughs", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 3, engagement: 4 }),
      makeScores({ delivery: 5, engagement: 6 }),
      makeScores({ delivery: 7, engagement: 8 }),
    ];

    const breakthroughs = detectBreakthroughs(evals);
    expect(breakthroughs).toHaveLength(2);
  });

  it("should handle empty input", () => {
    expect(detectBreakthroughs([])).toEqual([]);
  });

  it("should require at least 2 evaluations", () => {
    const evals: CategoryScore[][] = [
      makeScores({ delivery: 3 }),
    ];

    expect(detectBreakthroughs(evals)).toHaveLength(0);
  });

  it("should use exact boundary: gain of exactly 2 qualifies", () => {
    const evals: CategoryScore[][] = [
      makeScores({ structure: 5 }),
      makeScores({ structure: 7 }),
    ];

    const breakthroughs = detectBreakthroughs(evals);
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].category).toBe("structure");
  });

  it("should compare first to last score, not intermediate", () => {
    // Started at 4, dipped to 3, ended at 7 = gain of 3
    const evals: CategoryScore[][] = [
      makeScores({ content: 4 }),
      makeScores({ content: 3 }),
      makeScores({ content: 7 }),
    ];

    const breakthroughs = detectBreakthroughs(evals);
    expect(breakthroughs).toHaveLength(1);
    expect(breakthroughs[0].category).toBe("content");
  });
});
