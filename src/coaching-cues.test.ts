// Coaching Cues — TDD tests (#155)

import { describe, it, expect } from "vitest";
import { computeCues, createCueState } from "./coaching-cues.js";
import type { TranscriptSegment, TranscriptWord } from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeWord(word: string, startTime: number, endTime?: number): TranscriptWord {
  return {
    word,
    startTime,
    endTime: endTime ?? startTime + 0.3,
    confidence: 0.95,
  };
}

function makeSegment(words: TranscriptWord[], isFinal = true): TranscriptSegment {
  return {
    text: words.map((w) => w.word).join(" "),
    startTime: words[0]?.startTime ?? 0,
    endTime: words[words.length - 1]?.endTime ?? 0,
    words,
    isFinal,
  };
}

/** Generate N words evenly spaced over a duration */
function generateWords(count: number, durationSeconds: number, startAt = 0): TranscriptWord[] {
  const gap = durationSeconds / count;
  return Array.from({ length: count }, (_, i) =>
    makeWord("hello", startAt + i * gap, startAt + i * gap + 0.2),
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("computeCues", () => {
  describe("pace_fast", () => {
    it("should trigger when WPM > 180", () => {
      // 200 words in 60 seconds = 200 WPM
      const words = generateWords(200, 60);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 60, state);
      expect(cues).toContainEqual(
        expect.objectContaining({ type: "pace_fast" }),
      );
    });

    it("should NOT trigger when WPM is normal", () => {
      // 150 words in 60 seconds = 150 WPM
      const words = generateWords(150, 60);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 60, state);
      expect(cues.filter((c) => c.type === "pace_fast")).toHaveLength(0);
    });

    it("should NOT trigger with fewer than minimum words", () => {
      // 10 words in 3 seconds = 200 WPM but only 10 words (below minWordsForWpm=15)
      const words = generateWords(10, 3);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 3, state);
      expect(cues.filter((c) => c.type === "pace_fast")).toHaveLength(0);
    });
  });

  describe("pace_slow", () => {
    it("should trigger when WPM < 100", () => {
      // 20 words in 30 seconds = 40 WPM
      const words = generateWords(20, 30);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 30, state);
      expect(cues).toContainEqual(
        expect.objectContaining({ type: "pace_slow" }),
      );
    });

    it("should NOT trigger when WPM is normal", () => {
      // 150 words in 60 seconds = 150 WPM
      const words = generateWords(150, 60);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 60, state);
      expect(cues.filter((c) => c.type === "pace_slow")).toHaveLength(0);
    });
  });

  describe("filler_alert", () => {
    it("should trigger when 2+ fillers in last 30 seconds", () => {
      const words = [
        makeWord("hello", 0),
        makeWord("um", 5),
        makeWord("world", 10),
        makeWord("uh", 15),
        makeWord("okay", 20),
      ];
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 25, state);
      expect(cues).toContainEqual(
        expect.objectContaining({ type: "filler_alert" }),
      );
    });

    it("should NOT trigger with only 1 filler", () => {
      const words = [
        makeWord("hello", 0),
        makeWord("um", 5),
        makeWord("world", 10),
        makeWord("great", 15),
        makeWord("speech", 20),
        ...generateWords(12, 10, 21), // pad to meet minimum
      ];
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 35, state);
      expect(cues.filter((c) => c.type === "filler_alert")).toHaveLength(0);
    });

    it("should NOT count fillers outside the 30-second lookback window", () => {
      const words = [
        makeWord("um", 5),
        makeWord("uh", 10),
        // These are > 30 seconds ago from elapsed=50
        ...generateWords(15, 10, 35), // normal words in recent window
      ];
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 50, state);
      expect(cues.filter((c) => c.type === "filler_alert")).toHaveLength(0);
    });
  });

  describe("long_pause", () => {
    it("should trigger when gap since last word exceeds threshold", () => {
      const words = [
        makeWord("hello", 0, 0.5),
        makeWord("world", 1, 1.5),
      ];
      const seg = makeSegment(words);
      const state = createCueState();
      // Last word ended at 1.5, elapsed is 15 = 13.5s gap > 8s threshold
      const cues = computeCues([seg], 15, state);
      expect(cues).toContainEqual(
        expect.objectContaining({ type: "long_pause" }),
      );
    });

    it("should NOT trigger when gap is within threshold", () => {
      const words = [
        makeWord("hello", 0, 0.5),
        makeWord("world", 1, 1.5),
      ];
      const seg = makeSegment(words);
      const state = createCueState();
      // Last word ended at 1.5, elapsed is 5 = 3.5s gap < 8s threshold
      const cues = computeCues([seg], 5, state);
      expect(cues.filter((c) => c.type === "long_pause")).toHaveLength(0);
    });
  });

  describe("cooldown", () => {
    it("should NOT repeat the same cue type within 30 seconds", () => {
      // First call triggers pace_fast
      const words = generateWords(200, 60);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues1 = computeCues([seg], 60, state);
      expect(cues1).toContainEqual(expect.objectContaining({ type: "pace_fast" }));

      // Second call at t=70 (only 10s later) should NOT trigger again
      const words2 = generateWords(250, 70);
      const seg2 = makeSegment(words2);
      const cues2 = computeCues([seg2], 70, state);
      expect(cues2.filter((c) => c.type === "pace_fast")).toHaveLength(0);
    });

    it("should allow the same cue type after cooldown expires", () => {
      const words = generateWords(200, 60);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues1 = computeCues([seg], 60, state);
      expect(cues1).toContainEqual(expect.objectContaining({ type: "pace_fast" }));

      // After 30s cooldown (t=91), should trigger again
      const words2 = generateWords(400, 91);
      const seg2 = makeSegment(words2);
      const cues2 = computeCues([seg2], 91, state);
      expect(cues2).toContainEqual(expect.objectContaining({ type: "pace_fast" }));
    });

    it("should allow different cue types within cooldown", () => {
      const state = createCueState();
      // Trigger pace_fast
      const fast = generateWords(200, 60);
      computeCues([makeSegment(fast)], 60, state);

      // Then filler_alert at t=65 (within pace_fast cooldown) — should still trigger
      const fillerWords = [
        ...generateWords(15, 10, 35), // enough words for minWordCount
        makeWord("um", 60),
        makeWord("uh", 62),
      ];
      const cues = computeCues([makeSegment(fillerWords)], 65, state);
      expect(cues).toContainEqual(expect.objectContaining({ type: "filler_alert" }));
    });
  });

  describe("edge cases", () => {
    it("should return empty array for empty segments", () => {
      const state = createCueState();
      const cues = computeCues([], 10, state);
      expect(cues).toEqual([]);
    });

    it("should ignore non-final segments", () => {
      const words = generateWords(200, 60);
      const seg = makeSegment(words, false); // isFinal = false
      const state = createCueState();
      const cues = computeCues([seg], 60, state);
      expect(cues).toEqual([]);
    });

    it("should return empty array at elapsed = 0", () => {
      const words = generateWords(200, 60);
      const seg = makeSegment(words);
      const state = createCueState();
      const cues = computeCues([seg], 0, state);
      expect(cues).toEqual([]);
    });
  });
});
