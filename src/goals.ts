/**
 * Speaker Goal Setting — CRUD + evaluation logic.
 *
 * Goals are stored per-speaker in GCS at:
 *   results/{speaker}/goals.json
 *
 * Issue: #153
 */

import type { GcsHistoryClient, SpeakerProgressEntry } from "./gcs-history.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SpeakerGoal {
  id: string;
  metric: "wpm" | "filler_frequency" | "category_score";
  /** For category_score goals: which category (delivery, content, structure, engagement) */
  category?: string;
  direction: "above" | "below" | "between";
  target: number;
  /** Upper bound for "between" direction */
  targetHigh?: number;
  created: string; // ISO date
}

export interface GoalEvaluation {
  goal: SpeakerGoal;
  currentValue: number | null;
  met: boolean;
  delta: number; // signed distance from target (positive = good)
}

export interface GoalsFile {
  goals: SpeakerGoal[];
}

// ─── Path Helper ────────────────────────────────────────────────────────────────

function goalsPath(speaker: string): string {
  return `results/${speaker}/goals.json`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────────

export async function loadGoals(
  client: GcsHistoryClient,
  speaker: string,
): Promise<SpeakerGoal[]> {
  const path = goalsPath(speaker);
  const exists = await client.fileExists(path);
  if (!exists) return [];

  const content = await client.readFile(path);
  const parsed = JSON.parse(content) as GoalsFile;
  return parsed.goals ?? [];
}

export async function saveGoals(
  client: GcsHistoryClient,
  speaker: string,
  goals: SpeakerGoal[],
): Promise<void> {
  const path = goalsPath(speaker);
  const payload: GoalsFile = { goals };
  await client.saveFile(path, JSON.stringify(payload, null, 2), "application/json");
}

// ─── Evaluation ─────────────────────────────────────────────────────────────────

/**
 * Extract the latest metric value from progress data for a given goal.
 */
function getLatestMetricValue(
  goal: SpeakerGoal,
  progress: SpeakerProgressEntry[],
  categoryScores?: Array<{ category: string; score: number }>,
): number | null {
  if (progress.length === 0) return null;

  const latest = progress[progress.length - 1];

  switch (goal.metric) {
    case "wpm":
      return latest.wordsPerMinute ?? null;
    case "filler_frequency":
      return latest.fillerWordFrequency ?? null;
    case "category_score": {
      if (!categoryScores || !goal.category) return null;
      const match = categoryScores.find(
        (cs) => cs.category === goal.category,
      );
      return match?.score ?? null;
    }
    default:
      return null;
  }
}

/**
 * Evaluate whether a goal is met and compute delta.
 */
function evaluateSingleGoal(
  goal: SpeakerGoal,
  currentValue: number | null,
): { met: boolean; delta: number } {
  if (currentValue === null) return { met: false, delta: 0 };

  switch (goal.direction) {
    case "above":
      return {
        met: currentValue >= goal.target,
        delta: currentValue - goal.target,
      };
    case "below":
      return {
        met: currentValue <= goal.target,
        delta: goal.target - currentValue,
      };
    case "between": {
      const high = goal.targetHigh ?? goal.target;
      if (currentValue >= goal.target && currentValue <= high) {
        return { met: true, delta: 0 };
      }
      // Distance from nearest bound
      const distLow = goal.target - currentValue;
      const distHigh = currentValue - high;
      return {
        met: false,
        delta: currentValue < goal.target ? -distLow : -distHigh,
      };
    }
    default:
      return { met: false, delta: 0 };
  }
}

/**
 * Evaluate all goals against the latest progress data.
 */
export function evaluateGoals(
  goals: SpeakerGoal[],
  progress: SpeakerProgressEntry[],
  categoryScores?: Array<{ category: string; score: number }>,
): GoalEvaluation[] {
  return goals.map((goal) => {
    const currentValue = getLatestMetricValue(goal, progress, categoryScores);
    const { met, delta } = evaluateSingleGoal(goal, currentValue);
    return { goal, currentValue, met, delta };
  });
}
