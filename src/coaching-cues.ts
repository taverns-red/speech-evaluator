// Real-time Coaching Cues — pure logic for generating coaching tips during recording (#155)

import type { TranscriptSegment } from "./types.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type CueType = "pace_fast" | "pace_slow" | "filler_alert" | "long_pause";

export interface CoachingCue {
  type: CueType;
  message: string;
  timestamp: number; // seconds into the recording
}

export interface CueState {
  /** Timestamp of last emitted cue per type (seconds), used for cooldown */
  lastEmitted: Partial<Record<CueType, number>>;
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const CUE_CONFIG = {
  /** WPM above this triggers pace_fast */
  fastWpmThreshold: 180,
  /** WPM below this triggers pace_slow */
  slowWpmThreshold: 100,
  /** Minimum words needed to compute reliable WPM */
  minWordsForWpm: 15,
  /** Number of fillers in the lookback window to trigger filler_alert */
  fillerCountThreshold: 2,
  /** Lookback window in seconds for filler detection */
  fillerLookbackSeconds: 30,
  /** Pause longer than this (seconds) triggers long_pause */
  longPauseThreshold: 8,
  /** Cooldown per cue type in seconds — same type not repeated within this window */
  cooldownSeconds: 30,
} as const;

const CUE_MESSAGES: Record<CueType, string> = {
  pace_fast: "You're speeding up — try slowing down",
  pace_slow: "You're speaking slowly — try picking up the pace",
  filler_alert: "Filler words detected — pause instead of filling",
  long_pause: "Long pause detected — are you ready to continue?",
};

// ─── Filler word set (subset of metrics-extractor.ts) ───────────────────────────

const FILLER_WORDS = new Set([
  "um", "uh", "er", "ah", "like", "you know", "so", "actually",
  "basically", "literally", "right", "okay",
]);

// ─── Core Logic ─────────────────────────────────────────────────────────────────

/**
 * Creates a fresh cue state — no cues emitted yet.
 */
export function createCueState(): CueState {
  return { lastEmitted: {} };
}

/**
 * Compute coaching cues from the current transcript segments.
 *
 * This is a pure function (given the same segments + elapsed + state, returns same result).
 * It mutates `state.lastEmitted` when a cue is emitted (for cooldown tracking).
 *
 * @param segments - All transcript segments accumulated so far
 * @param elapsedSeconds - Total recording time so far
 * @param state - Mutable cue state for cooldown tracking
 * @returns Array of coaching cues to emit (may be empty)
 */
export function computeCues(
  segments: TranscriptSegment[],
  elapsedSeconds: number,
  state: CueState,
): CoachingCue[] {
  const cues: CoachingCue[] = [];

  // Collect all words from final segments
  const allWords = segments
    .filter((s) => s.isFinal)
    .flatMap((s) => s.words);

  if (allWords.length === 0) return cues;

  // ── WPM check ──────────────────────────────────────────────────────────────
  if (allWords.length >= CUE_CONFIG.minWordsForWpm && elapsedSeconds > 0) {
    const wpm = (allWords.length / elapsedSeconds) * 60;
    if (wpm > CUE_CONFIG.fastWpmThreshold) {
      maybeEmit(cues, state, "pace_fast", elapsedSeconds);
    } else if (wpm < CUE_CONFIG.slowWpmThreshold) {
      maybeEmit(cues, state, "pace_slow", elapsedSeconds);
    }
  }

  // ── Filler check (last N seconds) ──────────────────────────────────────────
  const lookbackStart = Math.max(0, elapsedSeconds - CUE_CONFIG.fillerLookbackSeconds);
  const recentFillers = allWords.filter(
    (w) => w.startTime >= lookbackStart && FILLER_WORDS.has(w.word.toLowerCase()),
  );
  if (recentFillers.length >= CUE_CONFIG.fillerCountThreshold) {
    maybeEmit(cues, state, "filler_alert", elapsedSeconds);
  }

  // ── Long pause check ──────────────────────────────────────────────────────
  if (allWords.length >= 2) {
    // Check the gap between the last word's end time and the current elapsed time
    const lastWord = allWords[allWords.length - 1];
    const gapSinceLastWord = elapsedSeconds - lastWord.endTime;
    if (gapSinceLastWord > CUE_CONFIG.longPauseThreshold) {
      maybeEmit(cues, state, "long_pause", elapsedSeconds);
    }
  }

  return cues;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function maybeEmit(
  cues: CoachingCue[],
  state: CueState,
  type: CueType,
  now: number,
): void {
  const last = state.lastEmitted[type];
  if (last !== undefined && now - last < CUE_CONFIG.cooldownSeconds) return;
  state.lastEmitted[type] = now;
  cues.push({ type, message: CUE_MESSAGES[type], timestamp: now });
}
