/**
 * Tests for improvement-plan.ts — aggregation logic, trend detection,
 * weakest category identification.
 *
 * Phase 8 — #145
 */

import { describe, it, expect, vi } from "vitest";
import {
  aggregateCategoryScores,
  computeTrend,
  findWeakestCategory,
  generateExercises,
  type CategoryAggregate,
  type PracticeExercise,
} from "./improvement-plan.js";
import type { CategoryScore } from "./types.js";

// ─── computeTrend ────────────────────────────────────────────────────────────────

describe("computeTrend", () => {
  it("should return 'stable' for single score", () => {
    expect(computeTrend([7])).toBe("stable");
  });

  it("should return 'improving' when second half is higher", () => {
    expect(computeTrend([4, 5, 7, 8])).toBe("improving");
  });

  it("should return 'declining' when second half is lower", () => {
    expect(computeTrend([8, 7, 5, 4])).toBe("declining");
  });

  it("should return 'stable' when difference is < 0.5", () => {
    expect(computeTrend([6, 6, 6.3, 6.3])).toBe("stable");
  });

  it("should handle two scores", () => {
    expect(computeTrend([3, 8])).toBe("improving");
    expect(computeTrend([8, 3])).toBe("declining");
  });

  it("should handle empty array", () => {
    expect(computeTrend([])).toBe("stable");
  });
});

// ─── aggregateCategoryScores ─────────────────────────────────────────────────────

describe("aggregateCategoryScores", () => {
  it("should aggregate scores across evaluations", () => {
    const evaluations: CategoryScore[][] = [
      [
        { category: "delivery", score: 6, rationale: "OK" },
        { category: "content", score: 7, rationale: "Good" },
        { category: "structure", score: 5, rationale: "Needs work" },
        { category: "engagement", score: 8, rationale: "Great" },
      ],
      [
        { category: "delivery", score: 8, rationale: "Improved" },
        { category: "content", score: 6, rationale: "Dropped" },
        { category: "structure", score: 7, rationale: "Better" },
        { category: "engagement", score: 7, rationale: "Good" },
      ],
    ];

    const result = aggregateCategoryScores(evaluations);
    expect(result).toHaveLength(4);

    const delivery = result.find(a => a.category === "delivery")!;
    expect(delivery.averageScore).toBe(7); // (6+8)/2

    const structure = result.find(a => a.category === "structure")!;
    expect(structure.averageScore).toBe(6); // (5+7)/2
  });

  it("should compute trends across evaluations", () => {
    const evaluations: CategoryScore[][] = [
      [{ category: "delivery", score: 4, rationale: "Weak" }],
      [{ category: "delivery", score: 5, rationale: "Better" }],
      [{ category: "delivery", score: 7, rationale: "Good" }],
      [{ category: "delivery", score: 8, rationale: "Great" }],
    ];

    const result = aggregateCategoryScores(evaluations);
    const delivery = result.find(a => a.category === "delivery")!;
    expect(delivery.trend).toBe("improving");
  });

  it("should skip unknown categories", () => {
    const evaluations: CategoryScore[][] = [
      [
        { category: "delivery", score: 7, rationale: "Good" },
        { category: "unknown" as any, score: 5, rationale: "Bad" },
      ],
    ];

    const result = aggregateCategoryScores(evaluations);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("delivery");
  });

  it("should handle empty input", () => {
    expect(aggregateCategoryScores([])).toEqual([]);
  });

  it("should handle evaluations with no matching categories", () => {
    const evaluations: CategoryScore[][] = [
      [{ category: "invalid" as any, score: 5, rationale: "Bad" }],
    ];
    expect(aggregateCategoryScores(evaluations)).toEqual([]);
  });
});

// ─── findWeakestCategory ─────────────────────────────────────────────────────────

describe("findWeakestCategory", () => {
  it("should find the category with lowest average", () => {
    const aggregates: CategoryAggregate[] = [
      { category: "delivery", averageScore: 7, trend: "stable", scores: [7] },
      { category: "content", averageScore: 4, trend: "stable", scores: [4] },
      { category: "structure", averageScore: 6, trend: "stable", scores: [6] },
    ];

    const result = findWeakestCategory(aggregates);
    expect(result!.category).toBe("content");
    expect(result!.averageScore).toBe(4);
  });

  it("should return null for empty aggregates", () => {
    expect(findWeakestCategory([])).toBeNull();
  });

  it("should handle single aggregate", () => {
    const aggregates: CategoryAggregate[] = [
      { category: "delivery", averageScore: 5, trend: "improving", scores: [5] },
    ];
    expect(findWeakestCategory(aggregates)!.category).toBe("delivery");
  });
});

// ─── generateExercises ──────────────────────────────────────────────────────────

describe("generateExercises", () => {
  it("should parse valid LLM response into exercises", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  exercises: [
                    { title: "Mirror Practice", description: "Stand in front of a mirror and deliver your opening.", duration: "5 minutes" },
                    { title: "Record Yourself", description: "Record a 2-minute speech and watch for filler words.", duration: "10 minutes" },
                  ],
                }),
              },
            }],
          })),
        },
      },
    };

    const focus: CategoryAggregate = {
      category: "delivery",
      averageScore: 4.5,
      trend: "stable",
      scores: [4, 5],
    };

    const all: CategoryAggregate[] = [
      focus,
      { category: "content", averageScore: 7, trend: "improving", scores: [7] },
    ];

    const result = await generateExercises(mockOpenai, focus, all);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Mirror Practice");
    expect(result[1].duration).toBe("10 minutes");
  });

  it("should handle empty LLM response", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{ message: { content: null } }],
          })),
        },
      },
    };

    const focus: CategoryAggregate = {
      category: "delivery",
      averageScore: 4,
      trend: "stable",
      scores: [4],
    };

    const result = await generateExercises(mockOpenai, focus, [focus]);
    expect(result).toEqual([]);
  });

  it("should cap exercises at 3", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  exercises: [
                    { title: "E1", description: "D1", duration: "5m" },
                    { title: "E2", description: "D2", duration: "5m" },
                    { title: "E3", description: "D3", duration: "5m" },
                    { title: "E4", description: "D4", duration: "5m" },
                  ],
                }),
              },
            }],
          })),
        },
      },
    };

    const focus: CategoryAggregate = {
      category: "delivery",
      averageScore: 3,
      trend: "declining",
      scores: [3],
    };

    const result = await generateExercises(mockOpenai, focus, [focus]);
    expect(result).toHaveLength(3);
  });

  it("should default missing duration to '5 minutes'", async () => {
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  exercises: [
                    { title: "Practice", description: "Do the thing" },
                  ],
                }),
              },
            }],
          })),
        },
      },
    };

    const focus: CategoryAggregate = {
      category: "engagement",
      averageScore: 3,
      trend: "stable",
      scores: [3],
    };

    const result = await generateExercises(mockOpenai, focus, [focus]);
    expect(result[0].duration).toBe("5 minutes");
  });
});
