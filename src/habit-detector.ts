/**
 * Habit Detector — identifies recurring patterns across a speaker's
 * evaluation history using category scores and delivery metrics.
 *
 * Purely data-driven (no LLM calls). Fast and free.
 *
 * Phase 8 — #147
 */

import type { GcsHistoryClient } from "./gcs-history.js";
import type { CategoryScore, ScoreCategory } from "./types.js";
import { createLogger } from "./logger.js";

const log = createLogger("HabitDetector");

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface HabitItem {
  category: ScoreCategory;
  /** Average score across the qualifying window */
  averageScore: number;
  /** Number of consecutive speeches where this pattern holds */
  speechCount: number;
  /** Individual scores (chronological, oldest first) */
  scores: number[];
}

export interface HabitReport {
  speakerName: string;
  evaluationCount: number;
  /** Categories scoring ≤5 for 3+ consecutive speeches */
  habits: HabitItem[];
  /** Categories that gained ≥2 points over the observation window */
  breakthroughs: HabitItem[];
  generatedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const RESULTS_PREFIX = "results/";
const MIN_EVALUATIONS = 3;
const MAX_EVALUATIONS = 10;
const HABIT_THRESHOLD = 5;       // Score at or below = weak
const HABIT_MIN_STREAK = 3;      // Must be weak for this many consecutive speeches
const BREAKTHROUGH_MIN_GAIN = 2; // Must improve by this much
const SCORE_CATEGORIES: ScoreCategory[] = ["delivery", "content", "structure", "engagement"];

// ─── Detection Logic ────────────────────────────────────────────────────────────

/**
 * Detects habits: categories that score ≤ HABIT_THRESHOLD for
 * HABIT_MIN_STREAK or more consecutive recent speeches.
 */
export function detectHabits(evaluationScores: CategoryScore[][]): HabitItem[] {
  const habits: HabitItem[] = [];

  for (const category of SCORE_CATEGORIES) {
    // Extract scores for this category, chronological order
    const scores = evaluationScores
      .map(evalScores => evalScores.find(cs => cs.category === category)?.score)
      .filter((s): s is number => s !== undefined);

    if (scores.length < HABIT_MIN_STREAK) continue;

    // Count consecutive recent speeches scoring ≤ threshold (from most recent backwards)
    let streak = 0;
    for (let i = scores.length - 1; i >= 0; i--) {
      if (scores[i] <= HABIT_THRESHOLD) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= HABIT_MIN_STREAK) {
      const streakScores = scores.slice(-streak);
      const avg = streakScores.reduce((a, b) => a + b, 0) / streakScores.length;
      habits.push({
        category,
        averageScore: Math.round(avg * 10) / 10,
        speechCount: streak,
        scores,
      });
    }
  }

  return habits;
}

/**
 * Detects breakthroughs: categories where the last score minus the first score
 * in the observation window shows improvement ≥ BREAKTHROUGH_MIN_GAIN.
 */
export function detectBreakthroughs(evaluationScores: CategoryScore[][]): HabitItem[] {
  const breakthroughs: HabitItem[] = [];

  for (const category of SCORE_CATEGORIES) {
    const scores = evaluationScores
      .map(evalScores => evalScores.find(cs => cs.category === category)?.score)
      .filter((s): s is number => s !== undefined);

    if (scores.length < 2) continue;

    // Compare most recent to earliest in window
    const earliest = scores[0];
    const latest = scores[scores.length - 1];
    const gain = latest - earliest;

    if (gain >= BREAKTHROUGH_MIN_GAIN) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      breakthroughs.push({
        category,
        averageScore: Math.round(avg * 10) / 10,
        speechCount: scores.length,
        scores,
      });
    }
  }

  return breakthroughs;
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────────

/**
 * Reads evaluation.json files for a speaker from GCS,
 * extracts category_scores, and detects habits + breakthroughs.
 */
export async function generateHabitReport(
  gcsClient: GcsHistoryClient,
  speakerName: string,
): Promise<HabitReport | null> {
  const sanitized = speakerName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const speakerPrefix = `${RESULTS_PREFIX}${sanitized}/`;

  log.info("Generating habit report", { speaker: sanitized });

  const prefixes = await gcsClient.listPrefixes(speakerPrefix, "/");
  const sorted = prefixes.sort(); // chronological, oldest first
  const capped = sorted.slice(-MAX_EVALUATIONS);

  // Read evaluation.json files and extract category_scores
  const allScores: CategoryScore[][] = [];

  for (const evalPrefix of capped) {
    try {
      const evalContent = await gcsClient.readFile(`${evalPrefix}evaluation.json`);
      const evalData = JSON.parse(evalContent);
      const evaluation = evalData.evaluation ?? evalData;

      if (evaluation.category_scores && Array.isArray(evaluation.category_scores)) {
        allScores.push(evaluation.category_scores);
      }
    } catch {
      // Skip unreadable evaluations
    }
  }

  if (allScores.length < MIN_EVALUATIONS) {
    log.info("Not enough evaluations for habit detection", {
      speaker: sanitized,
      found: allScores.length,
      required: MIN_EVALUATIONS,
    });
    return null;
  }

  const habits = detectHabits(allScores);
  const breakthroughs = detectBreakthroughs(allScores);

  return {
    speakerName,
    evaluationCount: allScores.length,
    habits,
    breakthroughs,
    generatedAt: new Date().toISOString(),
  };
}
