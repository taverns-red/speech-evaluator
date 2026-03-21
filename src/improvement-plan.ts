/**
 * Improvement Plan Generator — aggregates category scores across evaluations
 * and generates personalized practice recommendations via LLM.
 *
 * Phase 8 — #145
 */

import type OpenAI from "openai";
import type { GcsHistoryClient } from "./gcs-history.js";
import type { CategoryScore, ScoreCategory, StructuredEvaluation } from "./types.js";
import { createLogger } from "./logger.js";
import { withRetry } from "./retry.js";

const log = createLogger("ImprovementPlan");

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface CategoryAggregate {
  category: ScoreCategory;
  averageScore: number;
  trend: "improving" | "declining" | "stable";
  scores: number[]; // chronological, oldest first
}

export interface ImprovementPlan {
  speakerName: string;
  evaluationCount: number;
  categoryAverages: CategoryAggregate[];
  focusCategory: ScoreCategory;
  focusCategoryAvg: number;
  exercises: PracticeExercise[];
  generatedAt: string; // ISO 8601
}

export interface PracticeExercise {
  title: string;
  description: string;
  duration: string; // e.g., "5 minutes"
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const RESULTS_PREFIX = "results/";
const MIN_EVALUATIONS = 2;
const MAX_EVALUATIONS = 20;

const SCORE_CATEGORIES: ScoreCategory[] = ["delivery", "content", "structure", "engagement"];

// ─── Aggregation ────────────────────────────────────────────────────────────────

/**
 * Aggregates category scores from multiple evaluations.
 * Returns averages and trends for each category.
 */
export function aggregateCategoryScores(
  evaluationScores: CategoryScore[][],
): CategoryAggregate[] {
  const byCategory = new Map<ScoreCategory, number[]>();

  for (const cat of SCORE_CATEGORIES) {
    byCategory.set(cat, []);
  }

  for (const evalScores of evaluationScores) {
    for (const cs of evalScores) {
      const arr = byCategory.get(cs.category as ScoreCategory);
      if (arr) arr.push(cs.score);
    }
  }

  const aggregates: CategoryAggregate[] = [];

  for (const [category, scores] of byCategory) {
    if (scores.length === 0) continue;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend = computeTrend(scores);

    aggregates.push({
      category,
      averageScore: Math.round(avg * 10) / 10,
      trend,
      scores,
    });
  }

  return aggregates;
}

/**
 * Determines whether scores are improving, declining, or stable.
 * Compares the average of the first half to the second half.
 */
export function computeTrend(scores: number[]): "improving" | "declining" | "stable" {
  if (scores.length < 2) return "stable";

  const mid = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  if (diff > 0.5) return "improving";
  if (diff < -0.5) return "declining";
  return "stable";
}

/**
 * Identifies the weakest category by average score.
 * Ties broken alphabetically.
 */
export function findWeakestCategory(aggregates: CategoryAggregate[]): CategoryAggregate | null {
  if (aggregates.length === 0) return null;
  return aggregates.reduce((weakest, current) =>
    current.averageScore < weakest.averageScore ? current : weakest,
  );
}

// ─── LLM Plan Generation ────────────────────────────────────────────────────────

const PLAN_SYSTEM_PROMPT = `You are an experienced speech coach. Given a speaker's category scores, generate 2-3 concrete practice exercises for their weakest area.

Respond with a valid JSON object:
{
  "exercises": [
    {
      "title": "string (short label for the exercise)",
      "description": "string (2-3 sentences describing what to do and why)",
      "duration": "string (estimated time, e.g., '5 minutes')"
    }
  ]
}

Guidelines:
- Each exercise should be specific, actionable, and doable in a single practice session.
- Tailor exercises to the specific weaknesses described in the score data.
- Vary exercise types: solo practice, video recording, partner drills.
- Keep descriptions encouraging and practical.`;

/**
 * Generates practice exercises for the weakest category using LLM.
 */
export async function generateExercises(
  openai: { chat: { completions: { create: (...args: unknown[]) => Promise<{ choices: Array<{ message: { content: string | null } }> }> } } },
  focusCategory: CategoryAggregate,
  allAggregates: CategoryAggregate[],
): Promise<PracticeExercise[]> {
  const userPrompt = `Speaker's category scores (average over ${focusCategory.scores.length} speeches):
${allAggregates.map(a => `- ${a.category}: ${a.averageScore}/10 (${a.trend})`).join("\n")}

Weakest area: ${focusCategory.category} (${focusCategory.averageScore}/10, ${focusCategory.trend})

Generate targeted practice exercises for improving "${focusCategory.category}".`;

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
    { label: "improvement-plan-llm" },
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    log.warn("LLM returned empty response for improvement plan");
    return [];
  }

  try {
    const parsed = JSON.parse(content) as { exercises: PracticeExercise[] };
    if (!Array.isArray(parsed.exercises)) return [];

    return parsed.exercises
      .filter((e: unknown) => {
        if (!e || typeof e !== "object") return false;
        const ex = e as Record<string, unknown>;
        return typeof ex.title === "string" && typeof ex.description === "string";
      })
      .slice(0, 3)
      .map((e: PracticeExercise) => ({
        title: e.title,
        description: e.description,
        duration: e.duration || "5 minutes",
      }));
  } catch {
    log.warn("Failed to parse improvement plan LLM response");
    return [];
  }
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────────

/**
 * Reads evaluation.json files from GCS, extracts category_scores,
 * aggregates them, and generates an improvement plan.
 */
export async function generateImprovementPlan(
  gcsClient: GcsHistoryClient,
  openai: { chat: { completions: { create: (...args: unknown[]) => Promise<{ choices: Array<{ message: { content: string | null } }> }> } } },
  speakerName: string,
): Promise<ImprovementPlan | null> {
  const sanitized = speakerName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const speakerPrefix = `${RESULTS_PREFIX}${sanitized}/`;

  log.info("Generating improvement plan", { speaker: sanitized });

  // List all evaluation prefixes
  const prefixes = await gcsClient.listPrefixes(speakerPrefix, "/");
  const sorted = prefixes.sort(); // chronological, oldest first
  const capped = sorted.slice(-MAX_EVALUATIONS);

  // Read evaluation.json files and extract category_scores
  const allScores: CategoryScore[][] = [];

  for (const evalPrefix of capped) {
    try {
      const evalContent = await gcsClient.readFile(`${evalPrefix}evaluation.json`);
      const evalData = JSON.parse(evalContent);

      // The evaluation data wraps the StructuredEvaluation under .evaluation
      const evaluation = evalData.evaluation ?? evalData;

      if (evaluation.category_scores && Array.isArray(evaluation.category_scores)) {
        allScores.push(evaluation.category_scores);
      }
    } catch {
      // Skip evaluations that can't be read or don't have scores
    }
  }

  if (allScores.length < MIN_EVALUATIONS) {
    log.info("Not enough evaluations with category scores", {
      speaker: sanitized,
      found: allScores.length,
      required: MIN_EVALUATIONS,
    });
    return null;
  }

  // Aggregate scores
  const aggregates = aggregateCategoryScores(allScores);
  const weakest = findWeakestCategory(aggregates);

  if (!weakest) {
    log.warn("No category aggregates available", { speaker: sanitized });
    return null;
  }

  // Generate practice exercises via LLM
  const exercises = await generateExercises(openai, weakest, aggregates);

  return {
    speakerName,
    evaluationCount: allScores.length,
    categoryAverages: aggregates,
    focusCategory: weakest.category,
    focusCategoryAvg: weakest.averageScore,
    exercises,
    generatedAt: new Date().toISOString(),
  };
}
