// AI Speech Evaluator - Metrics Extractor
// Requirements: 3.1 (duration), 3.2 (WPM), 3.3 (filler words), 3.4 (pauses), 3.5 (JSON output), 3.6 (contextual filler detection)
// Phase 2: 5.1 (pause classification), 5.2 (intentional pauses), 5.3 (hesitation pauses)

import type {
  TranscriptSegment,
  DeliveryMetrics,
  FillerWordEntry,
  ClassifiedFillerEntry,
  ClassifiedPause,
  EnergyProfile,
  PitchProfile,
  PaceVariation,
  ProsodicIndicators,
} from "./types.js";

// ─── Known Filler Words ─────────────────────────────────────────────────────────

const KNOWN_FILLERS = new Set([
  "um",
  "uh",
  "ah",
  "like",
  "you know",
  "so",
  "basically",
  "right",
  "actually",
  "literally",
]);

// Single-word fillers that need contextual analysis
const CONTEXTUAL_FILLERS = new Set(["like", "so", "right", "actually"]);

// ─── Pause Classification Constants (Phase 2 — Req 5.1, 5.2, 5.3) ──────────────

// Known filler words used for hesitation detection in pause classification
const FILLER_WORDS_FOR_PAUSE = new Set([
  "um", "uh", "ah", "like", "so", "right", "actually", "basically", "literally", "honestly",
]);

// Sentence-ending punctuation characters
const SENTENCE_ENDING_PUNCT = /[.!?]$/;

// Common sentence-final words used in punctuation fallback heuristic
const COMMON_SENTENCE_FINAL_WORDS = new Set([
  "right", "so", "well", "yes", "no", "okay", "ok", "too", "now", "then",
  "here", "there", "today", "again", "together", "everyone", "all",
]);

// ─── Metrics Extractor ──────────────────────────────────────────────────────────

export class MetricsExtractor {
  private pauseThreshold: number; // reportable threshold (default 1.5s)
  private candidateThreshold: number; // candidate threshold (default 300ms)

  constructor(pauseThreshold: number = 1.5, candidateThreshold: number = 0.3) {
    this.pauseThreshold = pauseThreshold;
    this.candidateThreshold = candidateThreshold;
  }

  /**
   * Extract delivery metrics from finalized transcript segments.
   */
  extract(segments: TranscriptSegment[]): DeliveryMetrics {
    if (segments.length === 0) {
      return this.emptyMetrics();
    }

    // Duration: last segment endTime - first segment startTime
    const durationSeconds =
      segments[segments.length - 1].endTime - segments[0].startTime;

    const durationFormatted = this.formatDuration(durationSeconds);

    // Total words across all segments
    const totalWords = this.countTotalWords(segments);

    // WPM: totalWords / (durationSeconds / 60)
    const durationMinutes = durationSeconds / 60;
    const wordsPerMinute =
      durationMinutes > 0 ? totalWords / durationMinutes : 0;

    // Filler word detection with classification (Phase 2 — Req 5.9)
    const classifiedFillers = this.detectAndClassifyFillers(segments);

    // Backward compat: fillerWords contains only true fillers (same as Phase 1 behavior)
    const fillerWords: FillerWordEntry[] = classifiedFillers
      .filter((f) => f.classification === "true_filler")
      .map(({ word, count, timestamps }) => ({ word, count, timestamps }));
    const fillerWordCount = fillerWords.reduce((sum, f) => sum + f.count, 0);
    const fillerWordFrequency =
      durationMinutes > 0 ? fillerWordCount / durationMinutes : 0;

    // Pause detection with classification (Phase 2)
    const classifiedPauses = this.detectAndClassifyPauses(segments);
    const pauseCount = classifiedPauses.length;
    const totalPauseDurationSeconds = classifiedPauses.reduce(
      (sum, p) => sum + p.duration,
      0
    );
    const averagePauseDurationSeconds =
      pauseCount > 0 ? totalPauseDurationSeconds / pauseCount : 0;

    // Phase 2: Pause classification counts
    const intentionalPauseCount = classifiedPauses.filter(
      (p) => p.type === "intentional"
    ).length;
    const hesitationPauseCount = classifiedPauses.filter(
      (p) => p.type === "hesitation"
    ).length;

    return {
      durationSeconds,
      durationFormatted,
      totalWords,
      wordsPerMinute,
      fillerWords,
      fillerWordCount,
      fillerWordFrequency,
      pauseCount,
      totalPauseDurationSeconds,
      averagePauseDurationSeconds,
      // Phase 2 additions
      intentionalPauseCount,
      hesitationPauseCount,
      classifiedPauses,
      energyVariationCoefficient: 0,
      energyProfile: {
        windowDurationMs: 250,
        windows: [],
        coefficientOfVariation: 0,
        silenceThreshold: 0,
      },
      classifiedFillers,
      visualMetrics: null,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Compute speech energy profile from raw audio chunks.
   * Audio is raw PCM 16-bit signed little-endian mono at 16kHz.
   * Phase 2 — Requirements 5.5, 5.6, 5.7, 5.8, 5.11
   *
   * @param audioChunks - Array of raw PCM audio buffers
   * @param windowDurationMs - Window size in milliseconds (default 250ms)
   * @param sampleRate - Audio sample rate in Hz (default 16000)
   * @param silenceK - Multiplier for MAD in adaptive silence threshold (default 1.0)
   * @returns EnergyProfile with normalized RMS windows and coefficient of variation
   */
  computeEnergyProfile(
    audioChunks: Buffer[],
    windowDurationMs: number = 250,
    sampleRate: number = 16000,
    silenceK: number = 1.0
  ): EnergyProfile {
    // Concatenate all audio chunks into a single buffer
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);

    if (totalLength === 0) {
      return {
        windowDurationMs,
        windows: [],
        coefficientOfVariation: 0,
        silenceThreshold: 0,
      };
    }

    const combined = Buffer.concat(audioChunks, totalLength);

    // Each sample is 2 bytes (Int16), so total samples = totalLength / 2
    const totalSamples = Math.floor(combined.length / 2);

    if (totalSamples === 0) {
      return {
        windowDurationMs,
        windows: [],
        coefficientOfVariation: 0,
        silenceThreshold: 0,
      };
    }

    // Samples per window: sampleRate * windowDurationMs / 1000
    const samplesPerWindow = Math.floor((sampleRate * windowDurationMs) / 1000);

    if (samplesPerWindow === 0) {
      return {
        windowDurationMs,
        windows: [],
        coefficientOfVariation: 0,
        silenceThreshold: 0,
      };
    }

    // Step 1: Segment into windows and compute RMS per window
    const windowCount = Math.ceil(totalSamples / samplesPerWindow);
    const rawRms: number[] = [];

    for (let w = 0; w < windowCount; w++) {
      const startSample = w * samplesPerWindow;
      const endSample = Math.min(startSample + samplesPerWindow, totalSamples);
      const count = endSample - startSample;

      let sumSquares = 0;
      for (let s = startSample; s < endSample; s++) {
        // Read 16-bit signed little-endian sample
        const sample = combined.readInt16LE(s * 2);
        sumSquares += sample * sample;
      }

      const rms = Math.sqrt(sumSquares / count);
      rawRms.push(rms);
    }

    // Step 2: Normalize by max RMS (gain invariance)
    const maxRms = Math.max(...rawRms);

    let normalizedWindows: number[];
    if (maxRms === 0) {
      // All-silence: all windows are 0
      normalizedWindows = rawRms.map(() => 0);
    } else {
      normalizedWindows = rawRms.map((rms) => rms / maxRms);
    }

    // Step 3: Compute adaptive silence threshold: median + k * MAD
    const silenceThreshold = this.computeSilenceThreshold(normalizedWindows, silenceK);

    // Step 4: Exclude silence windows (below threshold)
    const nonSilenceWindows = normalizedWindows.filter((v) => v >= silenceThreshold);

    // Step 5: Compute coefficient of variation on non-silence windows
    const coefficientOfVariation = this.computeCV(nonSilenceWindows);

    return {
      windowDurationMs,
      windows: normalizedWindows,
      coefficientOfVariation,
      silenceThreshold,
    };
  }

  /**
   * Compute adaptive silence threshold: median(values) + k * MAD(values)
   * where MAD = median(|values - median(values)|)
   */
  private computeSilenceThreshold(values: number[], k: number): number {
    if (values.length === 0) return 0;

    const median = this.computeMedian(values);
    const deviations = values.map((v) => Math.abs(v - median));
    const mad = this.computeMedian(deviations);

    return median + k * mad;
  }

  /**
   * Compute the median of an array of numbers.
   */
  private computeMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Compute coefficient of variation: stddev / mean.
   * Returns 0 for empty arrays or single-element arrays (stddev = 0).
   */
  private computeCV(values: number[]): number {
    if (values.length <= 1) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (mean === 0) return 0;

    const variance =
      values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
    const stddev = Math.sqrt(variance);

    return stddev / mean;
  }

  // ─── Private Helpers (Filler & Pause) ───────────────────────────────────────

  private emptyMetrics(): DeliveryMetrics {
    return {
      durationSeconds: 0,
      durationFormatted: "0:00",
      totalWords: 0,
      wordsPerMinute: 0,
      fillerWords: [],
      fillerWordCount: 0,
      fillerWordFrequency: 0,
      pauseCount: 0,
      totalPauseDurationSeconds: 0,
      averagePauseDurationSeconds: 0,
      // Phase 2 additions
      intentionalPauseCount: 0,
      hesitationPauseCount: 0,
      classifiedPauses: [],
      energyVariationCoefficient: 0,
      energyProfile: {
        windowDurationMs: 250,
        windows: [],
        coefficientOfVariation: 0,
        silenceThreshold: 0,
      },
      classifiedFillers: [],
      visualMetrics: null,
    };
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  private countTotalWords(segments: TranscriptSegment[]): number {
    return segments.reduce((total, segment) => {
      if (segment.words.length > 0) {
        return total + segment.words.length;
      }
      // Fallback: count words from text if no word-level data
      const words = segment.text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);
      return total + words.length;
    }, 0);
  }

  /**
   * Detect filler words and classify each as true_filler or discourse_marker.
   * Phase 2 — Requirement 5.9
   *
   * - "um", "uh", "ah" → always true_filler
   * - "basically", "literally", "you know" → always true_filler
   * - Contextual words ("like", "so", "right", "actually") in filler position → true_filler
   * - Contextual words in non-filler position → discourse_marker
   */
  private detectAndClassifyFillers(
    segments: TranscriptSegment[]
  ): ClassifiedFillerEntry[] {
    const trueFillerMap = new Map<string, { count: number; timestamps: number[] }>();
    const discourseMarkerMap = new Map<string, { count: number; timestamps: number[] }>();

    for (const segment of segments) {
      if (segment.words.length > 0) {
        this.detectAndClassifyFillersFromWords(segment, trueFillerMap, discourseMarkerMap);
      } else {
        // Segment-level fallback: only non-contextual fillers detected (same as Phase 1)
        // Contextual words cannot be classified without word-level context
        this.detectFillersFromText(segment, trueFillerMap);
      }
    }

    const result: ClassifiedFillerEntry[] = [];

    for (const [word, data] of trueFillerMap.entries()) {
      result.push({
        word,
        count: data.count,
        timestamps: data.timestamps,
        classification: "true_filler",
      });
    }

    for (const [word, data] of discourseMarkerMap.entries()) {
      result.push({
        word,
        count: data.count,
        timestamps: data.timestamps,
        classification: "discourse_marker",
      });
    }

    return result;
  }

  /**
   * Word-level filler detection with classification.
   * Contextual words not in filler position are tracked as discourse markers.
   */
  private detectAndClassifyFillersFromWords(
    segment: TranscriptSegment,
    trueFillerMap: Map<string, { count: number; timestamps: number[] }>,
    discourseMarkerMap: Map<string, { count: number; timestamps: number[] }>
  ): void {
    const words = segment.words;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].word.toLowerCase().replace(/[^a-z]/g, "");

      // Check two-word fillers first ("you know")
      if (i < words.length - 1) {
        const nextWord = words[i + 1].word.toLowerCase().replace(/[^a-z]/g, "");
        const twoWord = `${word} ${nextWord}`;
        if (KNOWN_FILLERS.has(twoWord)) {
          this.addFiller(trueFillerMap, twoWord, words[i].startTime);
          continue;
        }
      }

      // Check single-word fillers
      if (!KNOWN_FILLERS.has(word)) continue;

      // Contextual check for ambiguous fillers
      if (CONTEXTUAL_FILLERS.has(word)) {
        if (this.isFillerInContext(word, words, i)) {
          // Contextual word in filler position → true_filler
          this.addFiller(trueFillerMap, word, words[i].startTime);
        } else {
          // Contextual word NOT in filler position → discourse_marker
          this.addFiller(discourseMarkerMap, word, words[i].startTime);
        }
      } else {
        // Non-contextual fillers (um, uh, ah, basically, literally) always true_filler
        this.addFiller(trueFillerMap, word, words[i].startTime);
      }
    }
  }

  private detectFillerWords(
    segments: TranscriptSegment[]
  ): FillerWordEntry[] {
    const fillerMap = new Map<string, { count: number; timestamps: number[] }>();

    for (const segment of segments) {
      if (segment.words.length > 0) {
        // Word-level detection
        this.detectFillersFromWords(segment, fillerMap);
      } else {
        // Segment-level fallback
        this.detectFillersFromText(segment, fillerMap);
      }
    }

    return Array.from(fillerMap.entries()).map(([word, data]) => ({
      word,
      count: data.count,
      timestamps: data.timestamps,
    }));
  }

  private detectFillersFromWords(
    segment: TranscriptSegment,
    fillerMap: Map<string, { count: number; timestamps: number[] }>
  ): void {
    const words = segment.words;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].word.toLowerCase().replace(/[^a-z]/g, "");

      // Check two-word fillers first ("you know")
      if (i < words.length - 1) {
        const nextWord = words[i + 1].word.toLowerCase().replace(/[^a-z]/g, "");
        const twoWord = `${word} ${nextWord}`;
        if (KNOWN_FILLERS.has(twoWord)) {
          this.addFiller(fillerMap, twoWord, words[i].startTime);
          continue;
        }
      }

      // Check single-word fillers
      if (!KNOWN_FILLERS.has(word)) continue;

      // Contextual check for ambiguous fillers
      if (CONTEXTUAL_FILLERS.has(word)) {
        if (this.isFillerInContext(word, words, i)) {
          this.addFiller(fillerMap, word, words[i].startTime);
        }
      } else {
        // Non-contextual fillers (um, uh, ah, basically, literally) always count
        this.addFiller(fillerMap, word, words[i].startTime);
      }
    }
  }

  private detectFillersFromText(
    segment: TranscriptSegment,
    fillerMap: Map<string, { count: number; timestamps: number[] }>
  ): void {
    const text = segment.text.toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, "");
      if (KNOWN_FILLERS.has(cleaned) && !CONTEXTUAL_FILLERS.has(cleaned)) {
        this.addFiller(fillerMap, cleaned, segment.startTime);
      }
    }
  }

  private isFillerInContext(
    word: string,
    words: { word: string }[],
    index: number
  ): boolean {
    switch (word) {
      case "like": {
        // "like" is a filler when mid-sentence and not preceded by verbs that take "like" as complement
        // e.g., "I, like, went to the store" vs "I like pizza"
        if (index === 0) return false; // sentence-initial "like" is usually not filler
        const prevWord = words[index - 1].word
          .toLowerCase()
          .replace(/[^a-z]/g, "");
        const verbsTakingLike = new Set([
          "would",
          "do",
          "dont",
          "did",
          "didnt",
          "really",
          "i",
          "you",
          "we",
          "they",
          "looks",
          "look",
          "feel",
          "feels",
          "sound",
          "sounds",
          "seem",
          "seems",
        ]);
        return !verbsTakingLike.has(prevWord);
      }
      case "so": {
        // "so" is a filler when sentence-initial (first word in segment or after a pause)
        return index === 0;
      }
      case "right": {
        // "right" is a filler when used as a tag question or interjection at end of clause
        return index === words.length - 1 || index === 0;
      }
      case "actually": {
        // "actually" is often a filler when sentence-initial
        return index === 0;
      }
      default:
        return false;
    }
  }

  private addFiller(
    fillerMap: Map<string, { count: number; timestamps: number[] }>,
    word: string,
    timestamp: number
  ): void {
    const existing = fillerMap.get(word);
    if (existing) {
      existing.count++;
      existing.timestamps.push(timestamp);
    } else {
      fillerMap.set(word, { count: 1, timestamps: [timestamp] });
    }
  }

  /**
   * Detect all pause candidates (gaps ≥ candidateThreshold) and classify
   * reportable pauses (gaps ≥ reportableThreshold) as intentional or hesitation.
   * Phase 2 — Requirements 5.1, 5.2, 5.3
   */
  private detectAndClassifyPauses(
    segments: TranscriptSegment[]
  ): ClassifiedPause[] {
    // Step 1: Detect all pause candidates (gaps ≥ candidateThreshold)
    const candidates = this.detectPauseCandidates(segments);

    // Step 2: Filter to reportable pauses (gaps ≥ reportableThreshold)
    const reportable = candidates.filter(
      (p) => p.duration >= this.pauseThreshold
    );

    // Step 3: Build a flat word list for context lookup during classification
    const flatWords = this.buildFlatWordList(segments);

    // Step 4: Classify each reportable pause
    return reportable.map((pause) =>
      this.classifyPause(pause, flatWords)
    );
  }

  /**
   * Detect all pause candidates: gaps ≥ candidateThreshold (default 300ms).
   * Checks both intra-segment word gaps and inter-segment gaps.
   */
  private detectPauseCandidates(
    segments: TranscriptSegment[]
  ): { start: number; end: number; duration: number }[] {
    const pauses: { start: number; end: number; duration: number }[] = [];

    // Check for word-level gaps within segments
    for (const segment of segments) {
      if (segment.words.length > 1) {
        for (let i = 1; i < segment.words.length; i++) {
          const gap =
            segment.words[i].startTime - segment.words[i - 1].endTime;
          if (gap >= this.candidateThreshold) {
            pauses.push({
              start: segment.words[i - 1].endTime,
              end: segment.words[i].startTime,
              duration: gap,
            });
          }
        }
      }
    }

    // Check for inter-segment gaps
    for (let i = 1; i < segments.length; i++) {
      const prevSegment = segments[i - 1];
      const nextSegment = segments[i];

      // Use word-level boundaries if available, otherwise segment-level
      const prevEnd =
        prevSegment.words.length > 0
          ? prevSegment.words[prevSegment.words.length - 1].endTime
          : prevSegment.endTime;
      const nextStart =
        nextSegment.words.length > 0
          ? nextSegment.words[0].startTime
          : nextSegment.startTime;

      const gap = nextStart - prevEnd;
      if (gap >= this.candidateThreshold) {
        pauses.push({
          start: prevEnd,
          end: nextStart,
          duration: gap,
        });
      }
    }

    return pauses;
  }

  /**
   * Build a flat list of words with their text and timestamps from all segments,
   * preserving order. Used for context lookup during pause classification.
   */
  private buildFlatWordList(
    segments: TranscriptSegment[]
  ): { word: string; startTime: number; endTime: number }[] {
    const flatWords: { word: string; startTime: number; endTime: number }[] = [];

    for (const segment of segments) {
      if (segment.words.length > 0) {
        for (const w of segment.words) {
          flatWords.push({
            word: w.word,
            startTime: w.startTime,
            endTime: w.endTime,
          });
        }
      } else {
        // Segment-level fallback: split text into words and distribute timestamps
        const words = segment.text
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        if (words.length === 0) continue;
        const wordDuration =
          (segment.endTime - segment.startTime) / words.length;
        for (let i = 0; i < words.length; i++) {
          flatWords.push({
            word: words[i],
            startTime: segment.startTime + i * wordDuration,
            endTime: segment.startTime + (i + 1) * wordDuration,
          });
        }
      }
    }

    return flatWords;
  }

  /**
   * Classify a single reportable pause as intentional or hesitation.
   *
   * Classification heuristics (from design doc):
   * - Intentional: preceding text ends with sentence-ending punctuation (.!?)
   *   AND following text starts a new clause/sentence
   * - Hesitation: preceding text ends mid-sentence (no terminal punctuation)
   * - Hesitation: preceding word is a known filler word
   * - Hesitation: following word repeats or rephrases the preceding word
   * - Fallback: heuristic combining pause duration + capitalization + sentence-final word
   * - Precedence: when both intentional and hesitation indicators present, hesitation wins
   * - Default: hesitation (conservative)
   */
  private classifyPause(
    pause: { start: number; end: number; duration: number },
    flatWords: { word: string; startTime: number; endTime: number }[]
  ): ClassifiedPause {
    // Find the word immediately before and after the pause
    const precedingWord = this.findWordBefore(pause.start, flatWords);
    const followingWord = this.findWordAfter(pause.end, flatWords);

    const hesitationReasons: string[] = [];
    const intentionalReasons: string[] = [];

    if (precedingWord && followingWord) {
      const precText = precedingWord.word;
      const followText = followingWord.word;
      const precCleaned = precText.toLowerCase().replace(/[^a-z]/g, "");
      const followCleaned = followText.toLowerCase().replace(/[^a-z]/g, "");

      // Check hesitation indicators
      // 1. Preceding word is a known filler word
      if (FILLER_WORDS_FOR_PAUSE.has(precCleaned)) {
        hesitationReasons.push(`preceded by filler word "${precCleaned}"`);
      }

      // 2. Following word repeats the preceding word
      if (precCleaned === followCleaned && precCleaned.length > 0) {
        hesitationReasons.push(`followed by repeated word "${followCleaned}"`);
      }

      // 3. Check if preceding text ends with sentence-ending punctuation
      const hasSentenceEndingPunct = SENTENCE_ENDING_PUNCT.test(precText.trim());

      if (hasSentenceEndingPunct) {
        // Check if following text starts a new sentence (capitalized or new clause)
        const followStartsNew =
          followText.length > 0 &&
          followText[0] === followText[0].toUpperCase() &&
          followText[0] !== followText[0].toLowerCase();

        if (followStartsNew) {
          intentionalReasons.push("follows complete sentence, precedes new sentence");
        } else {
          intentionalReasons.push("follows sentence-ending punctuation");
        }
      } else {
        // No terminal punctuation — apply punctuation fallback heuristic
        const fallbackResult = this.punctuationFallbackHeuristic(
          precCleaned,
          followText,
          pause.duration
        );
        if (fallbackResult.type === "intentional") {
          intentionalReasons.push(fallbackResult.reason);
        } else {
          hesitationReasons.push(fallbackResult.reason);
        }
      }
    } else if (precedingWord) {
      // Pause at the end of speech (no following word)
      const precText = precedingWord.word;
      if (SENTENCE_ENDING_PUNCT.test(precText.trim())) {
        intentionalReasons.push("follows complete sentence at end of speech");
      } else {
        hesitationReasons.push("mid-sentence pause at end of speech");
      }
    } else if (followingWord) {
      // Pause at the beginning of speech (no preceding word)
      hesitationReasons.push("pause before speech begins");
    } else {
      // No context available
      hesitationReasons.push("no surrounding context available");
    }

    // Precedence: hesitation wins when both indicators are present (conservative bias)
    if (hesitationReasons.length > 0) {
      return {
        start: pause.start,
        end: pause.end,
        duration: pause.duration,
        type: "hesitation",
        reason: hesitationReasons[0],
      };
    }

    if (intentionalReasons.length > 0) {
      return {
        start: pause.start,
        end: pause.end,
        duration: pause.duration,
        type: "intentional",
        reason: intentionalReasons[0],
      };
    }

    // Default: hesitation (conservative)
    return {
      start: pause.start,
      end: pause.end,
      duration: pause.duration,
      type: "hesitation",
      reason: "default classification (conservative)",
    };
  }

  /**
   * Punctuation fallback heuristic for when punctuation is absent or unreliable.
   * Uses a combination of:
   * - Pause duration (longer pauses more likely intentional)
   * - Capitalization of next token (capitalized → new sentence → intentional)
   * - Whether preceding token is a common sentence-final word
   */
  private punctuationFallbackHeuristic(
    precCleaned: string,
    followText: string,
    duration: number
  ): { type: "intentional" | "hesitation"; reason: string } {
    let intentionalScore = 0;

    // Factor 1: Pause duration — longer pauses (1.5-4s) suggest intentional
    if (duration >= 1.5 && duration <= 4.0) {
      intentionalScore++;
    }

    // Factor 2: Following word is capitalized (suggests new sentence)
    if (
      followText.length > 0 &&
      followText[0] === followText[0].toUpperCase() &&
      followText[0] !== followText[0].toLowerCase()
    ) {
      intentionalScore++;
    }

    // Factor 3: Preceding word is a common sentence-final word
    if (COMMON_SENTENCE_FINAL_WORDS.has(precCleaned)) {
      intentionalScore++;
    }

    // Need at least 2 of 3 indicators for intentional classification
    if (intentionalScore >= 2) {
      return {
        type: "intentional",
        reason: "punctuation fallback: duration/capitalization/sentence-final word heuristic",
      };
    }

    return {
      type: "hesitation",
      reason: "mid-sentence pause (no terminal punctuation)",
    };
  }

  /**
   * Find the word whose endTime is closest to (and ≤) the pause start time.
   */
  private findWordBefore(
    pauseStart: number,
    flatWords: { word: string; startTime: number; endTime: number }[]
  ): { word: string; startTime: number; endTime: number } | null {
    let best: { word: string; startTime: number; endTime: number } | null = null;
    let bestDist = Infinity;

    for (const w of flatWords) {
      const dist = pauseStart - w.endTime;
      if (dist >= -0.001 && dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }

    return best;
  }

  /**
   * Find the word whose startTime is closest to (and ≥) the pause end time.
   */
  private findWordAfter(
    pauseEnd: number,
    flatWords: { word: string; startTime: number; endTime: number }[]
  ): { word: string; startTime: number; endTime: number } | null {
    let best: { word: string; startTime: number; endTime: number } | null = null;
    let bestDist = Infinity;

    for (const w of flatWords) {
      const dist = w.startTime - pauseEnd;
      if (dist >= -0.001 && dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }

    return best;
  }

  // ─── Acoustic Analysis (#124) ─────────────────────────────────────────────────

  /**
   * Extract pitch profile (F0 contour) from raw PCM audio using autocorrelation.
   * Audio is raw PCM 16-bit signed little-endian mono at the given sample rate.
   *
   * @param audioChunks - Array of raw PCM audio buffers
   * @param windowDurationMs - Analysis window size in ms (default 30ms)
   * @param sampleRate - Audio sample rate in Hz (default 16000)
   * @returns PitchProfile with F0 contour and summary statistics
   */
  computePitchProfile(
    audioChunks: Buffer[],
    windowDurationMs: number = 30,
    sampleRate: number = 16000,
  ): PitchProfile {
    const emptyProfile: PitchProfile = {
      f0Values: [],
      windowDurationMs,
      minF0: 0,
      maxF0: 0,
      meanF0: 0,
      stdDevF0: 0,
      rangeSemitones: 0,
      voicedFraction: 0,
    };

    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalLength === 0) return emptyProfile;

    const combined = Buffer.concat(audioChunks, totalLength);
    const totalSamples = Math.floor(combined.length / 2);
    if (totalSamples === 0) return emptyProfile;

    const samplesPerWindow = Math.floor((sampleRate * windowDurationMs) / 1000);
    if (samplesPerWindow < 2) return emptyProfile;

    // F0 search range: 80-500 Hz (covers typical human speech)
    const minLag = Math.floor(sampleRate / 500); // max F0 = 500 Hz
    const maxLag = Math.floor(sampleRate / 80);   // min F0 = 80 Hz

    if (maxLag >= samplesPerWindow || minLag >= maxLag) return emptyProfile;

    // Hop size: 50% overlap
    const hopSize = Math.floor(samplesPerWindow / 2);
    const f0Values: number[] = [];

    for (let offset = 0; offset + samplesPerWindow <= totalSamples; offset += hopSize) {
      // Read window samples as floats
      const window: number[] = new Array(samplesPerWindow);
      for (let i = 0; i < samplesPerWindow; i++) {
        window[i] = combined.readInt16LE((offset + i) * 2) / 32768.0;
      }

      const f0 = this.detectF0Autocorrelation(window, sampleRate, minLag, maxLag);
      f0Values.push(f0);
    }

    // Compute statistics over voiced frames only
    const voicedF0 = f0Values.filter((f) => f > 0);
    const voicedFraction = f0Values.length > 0 ? voicedF0.length / f0Values.length : 0;

    if (voicedF0.length === 0) {
      return { ...emptyProfile, f0Values, voicedFraction: 0 };
    }

    const minF0 = Math.min(...voicedF0);
    const maxF0 = Math.max(...voicedF0);
    const meanF0 = voicedF0.reduce((a, b) => a + b, 0) / voicedF0.length;
    const variance = voicedF0.reduce((sum, v) => sum + (v - meanF0) ** 2, 0) / voicedF0.length;
    const stdDevF0 = Math.sqrt(variance);

    // Pitch range in semitones: 12 * log2(maxF0 / minF0)
    const rangeSemitones = minF0 > 0 ? 12 * Math.log2(maxF0 / minF0) : 0;

    return {
      f0Values,
      windowDurationMs,
      minF0,
      maxF0,
      meanF0,
      stdDevF0,
      rangeSemitones,
      voicedFraction,
    };
  }

  /**
   * Detect F0 using normalized autocorrelation with parabolic interpolation.
   * Returns the detected F0 in Hz, or 0 if the window is unvoiced.
   */
  private detectF0Autocorrelation(
    window: number[],
    sampleRate: number,
    minLag: number,
    maxLag: number,
  ): number {
    const n = window.length;

    // Compute RMS energy — skip silent frames
    let sumSquares = 0;
    for (let i = 0; i < n; i++) sumSquares += window[i] * window[i];
    const rms = Math.sqrt(sumSquares / n);
    if (rms < 0.01) return 0; // silence threshold

    // Autocorrelation for lags in [minLag, maxLag]
    let bestLag = 0;
    let bestCorr = -1;

    // Also compute r(0) for normalization
    let r0 = 0;
    for (let i = 0; i < n; i++) r0 += window[i] * window[i];

    for (let lag = minLag; lag <= Math.min(maxLag, n - 1); lag++) {
      let sum = 0;
      let denomA = 0;
      let denomB = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += window[i] * window[i + lag];
        denomA += window[i] * window[i];
        denomB += window[i + lag] * window[i + lag];
      }
      const denom = Math.sqrt(denomA * denomB);
      const corr = denom > 0 ? sum / denom : 0;

      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    // Voicing threshold — normalized correlation must be strong enough
    if (bestCorr < 0.3 || bestLag === 0) return 0;

    // Parabolic interpolation around the peak for sub-sample accuracy
    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < Math.min(maxLag, n - 1)) {
      // Recompute neighbors for parabolic fit
      const corrPrev = this.normalizedCorrelation(window, bestLag - 1);
      const corrNext = this.normalizedCorrelation(window, bestLag + 1);
      const shift = (corrPrev - corrNext) / (2 * (corrPrev - 2 * bestCorr + corrNext));
      if (Math.abs(shift) < 1) {
        refinedLag = bestLag + shift;
      }
    }

    return sampleRate / refinedLag;
  }

  /** Compute normalized autocorrelation at a specific lag. */
  private normalizedCorrelation(window: number[], lag: number): number {
    const n = window.length;
    let sum = 0;
    let denomA = 0;
    let denomB = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += window[i] * window[i + lag];
      denomA += window[i] * window[i];
      denomB += window[i + lag] * window[i + lag];
    }
    const denom = Math.sqrt(denomA * denomB);
    return denom > 0 ? sum / denom : 0;
  }

  /**
   * Compute speaking pace variation using sliding-window WPM analysis.
   * Analyzes how consistently the speaker maintains their pace across the speech.
   *
   * @param segments - Transcript segments with word-level timestamps
   * @param windowDurationSeconds - Window size in seconds (default 30)
   * @param strideSeconds - Stride between windows in seconds (default 10)
   * @returns PaceVariation with local WPM values and variability statistics
   */
  computePaceVariation(
    segments: TranscriptSegment[],
    windowDurationSeconds: number = 30,
    strideSeconds: number = 10,
  ): PaceVariation {
    const emptyResult: PaceVariation = {
      localWPM: [],
      windowDurationSeconds,
      strideSeconds,
      meanWPM: 0,
      stdDevWPM: 0,
      variationCoefficient: 0,
      peakWPM: 0,
      troughWPM: 0,
    };

    if (segments.length === 0) return emptyResult;

    // Build flat word list with timestamps
    const words: { startTime: number; endTime: number }[] = [];
    for (const seg of segments) {
      if (seg.words.length > 0) {
        for (const w of seg.words) {
          words.push({ startTime: w.startTime, endTime: w.endTime });
        }
      } else {
        // Segment-level: distribute words evenly
        const wordTexts = seg.text.trim().split(/\s+/).filter((w) => w.length > 0);
        if (wordTexts.length === 0) continue;
        const wordDuration = (seg.endTime - seg.startTime) / wordTexts.length;
        for (let i = 0; i < wordTexts.length; i++) {
          words.push({
            startTime: seg.startTime + i * wordDuration,
            endTime: seg.startTime + (i + 1) * wordDuration,
          });
        }
      }
    }

    if (words.length === 0) return emptyResult;

    const speechStart = words[0].startTime;
    const speechEnd = words[words.length - 1].endTime;
    const speechDuration = speechEnd - speechStart;

    // Need at least one full window
    if (speechDuration < windowDurationSeconds) {
      // Single window = entire speech, no variation
      const wpm = (words.length / speechDuration) * 60;
      return {
        localWPM: [wpm],
        windowDurationSeconds,
        strideSeconds,
        meanWPM: wpm,
        stdDevWPM: 0,
        variationCoefficient: 0,
        peakWPM: wpm,
        troughWPM: wpm,
      };
    }

    // Slide windows and count words in each
    const localWPM: number[] = [];
    for (
      let windowStart = speechStart;
      windowStart + windowDurationSeconds <= speechEnd;
      windowStart += strideSeconds
    ) {
      const windowEnd = windowStart + windowDurationSeconds;
      // Count words that start within this window
      const wordCount = words.filter(
        (w) => w.startTime >= windowStart && w.startTime < windowEnd,
      ).length;
      const wpm = (wordCount / windowDurationSeconds) * 60;
      localWPM.push(wpm);
    }

    if (localWPM.length === 0) return emptyResult;

    const meanWPM = localWPM.reduce((a, b) => a + b, 0) / localWPM.length;
    const variance = localWPM.reduce((sum, v) => sum + (v - meanWPM) ** 2, 0) / localWPM.length;
    const stdDevWPM = Math.sqrt(variance);
    const variationCoefficient = meanWPM > 0 ? stdDevWPM / meanWPM : 0;

    return {
      localWPM,
      windowDurationSeconds,
      strideSeconds,
      meanWPM,
      stdDevWPM,
      variationCoefficient,
      peakWPM: Math.max(...localWPM),
      troughWPM: Math.min(...localWPM),
    };
  }

  /**
   * Compute prosodic confidence indicators from audio and transcript data.
   *
   * - Pitch jitter: std dev of F0 deltas between consecutive voiced frames (nervousness)
   * - Onset strength: mean RMS energy at utterance starts (confidence/projection)
   *
   * @param audioChunks - Raw PCM audio buffers
   * @param segments - Transcript segments for utterance boundary detection
   * @param sampleRate - Audio sample rate in Hz (default 16000)
   * @returns ProsodicIndicators
   */
  computeProsodicIndicators(
    audioChunks: Buffer[],
    segments: TranscriptSegment[],
    sampleRate: number = 16000,
  ): ProsodicIndicators {
    const emptyResult: ProsodicIndicators = {
      pitchJitter: 0,
      meanOnsetStrength: 0,
      onsetCount: 0,
    };

    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalLength === 0 || segments.length === 0) return emptyResult;

    const combined = Buffer.concat(audioChunks, totalLength);
    const totalSamples = Math.floor(combined.length / 2);
    if (totalSamples === 0) return emptyResult;

    // 1. Pitch jitter: compute from pitch profile
    const pitchProfile = this.computePitchProfile(audioChunks, 30, sampleRate);
    const voicedF0 = pitchProfile.f0Values.filter((f) => f > 0);
    let pitchJitter = 0;

    if (voicedF0.length >= 2) {
      // Compute deltas between consecutive voiced frames
      const deltas: number[] = [];
      for (let i = 1; i < voicedF0.length; i++) {
        deltas.push(Math.abs(voicedF0[i] - voicedF0[i - 1]));
      }
      const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const variance = deltas.reduce((sum, d) => sum + (d - meanDelta) ** 2, 0) / deltas.length;
      pitchJitter = Math.sqrt(variance);
    }

    // 2. Onset strength: measure RMS energy at the start of each utterance
    //    An "utterance" starts when there's a gap >= 300ms followed by speech
    const onsetWindowMs = 100; // first 100ms of each utterance
    const onsetSamples = Math.floor((sampleRate * onsetWindowMs) / 1000);
    const gapThresholdMs = 300;

    // Find utterance starts from transcript word gaps
    const flatWords: { startTime: number }[] = [];
    for (const seg of segments) {
      if (seg.words.length > 0) {
        for (const w of seg.words) {
          flatWords.push({ startTime: w.startTime });
        }
      }
    }

    const onsetStrengths: number[] = [];

    if (flatWords.length > 0) {
      // First word is always an onset
      const firstOnsetRMS = this.computeRMSAt(combined, totalSamples, flatWords[0].startTime, onsetSamples, sampleRate);
      if (firstOnsetRMS > 0) onsetStrengths.push(firstOnsetRMS);

      // Subsequent onsets: words preceded by gaps >= gapThresholdMs
      for (let i = 1; i < flatWords.length; i++) {
        // Estimate gap from transcript (approximate, but consistent with existing pause detection)
        const gap = flatWords[i].startTime - flatWords[i - 1].startTime;
        if (gap >= gapThresholdMs / 1000) {
          const rms = this.computeRMSAt(combined, totalSamples, flatWords[i].startTime, onsetSamples, sampleRate);
          if (rms > 0) onsetStrengths.push(rms);
        }
      }
    }

    const meanOnsetStrength = onsetStrengths.length > 0
      ? onsetStrengths.reduce((a, b) => a + b, 0) / onsetStrengths.length
      : 0;

    return {
      pitchJitter,
      meanOnsetStrength,
      onsetCount: onsetStrengths.length,
    };
  }

  /**
   * Compute RMS energy at a specific time offset in the audio buffer.
   * Returns 0 if the offset is out of range.
   */
  private computeRMSAt(
    buffer: Buffer,
    totalSamples: number,
    timeSeconds: number,
    windowSamples: number,
    sampleRate: number,
  ): number {
    const startSample = Math.floor(timeSeconds * sampleRate);
    const endSample = Math.min(startSample + windowSamples, totalSamples);

    if (startSample >= totalSamples || startSample < 0) return 0;
    if (endSample <= startSample) return 0;

    let sumSquares = 0;
    const count = endSample - startSample;
    for (let i = startSample; i < endSample; i++) {
      const sample = buffer.readInt16LE(i * 2) / 32768.0;
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / count);
  }
}
