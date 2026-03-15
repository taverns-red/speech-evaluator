/**
 * AI Ah-Counter — per-speaker filler word tracking and reporting.
 *
 * The Ah-Counter is one of the most valued meeting roles at Toastmasters.
 * This role analyzes the transcript and metrics to produce a structured
 * filler word report with counts, timestamps, and a spoken summary.
 *
 * This is a deterministic role — no LLM calls required. It reuses the
 * existing filler word detection from MetricsExtractor.
 *
 * Issue: #73
 */

import type { MeetingRole, RoleContext, RoleResult, StructuredReport, ReportSection } from "../meeting-role.js";
import type { FillerWordEntry, ClassifiedFillerEntry } from "../types.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_ID = "ah-counter";
const ROLE_NAME = "Ah-Counter";
const ROLE_DESCRIPTION = "Tracks filler words and verbal crutches, providing a detailed breakdown with timestamps.";

// ─── Ah-Counter Role ────────────────────────────────────────────────────────────

export class AhCounterRole implements MeetingRole {
  readonly id = ROLE_ID;
  readonly name = ROLE_NAME;
  readonly description = ROLE_DESCRIPTION;
  readonly requiredInputs = ["transcript", "metrics"] as const;

  async run(context: RoleContext): Promise<RoleResult> {
    const { metrics } = context;

    if (!metrics) {
      throw new Error("Ah-Counter requires metrics data (includes filler word analysis).");
    }

    const wordOfTheDay = typeof context.config.wordOfTheDay === "string"
      ? context.config.wordOfTheDay
      : null;

    const report = this.buildReport(metrics.fillerWords, metrics.classifiedFillers, metrics, wordOfTheDay, context);
    const script = this.renderScript(metrics.fillerWords, metrics.classifiedFillers, metrics, wordOfTheDay, context);

    return {
      roleId: this.id,
      report,
      script,
    };
  }

  // ─── Report Building ─────────────────────────────────────────────────────

  private buildReport(
    fillerWords: FillerWordEntry[],
    classifiedFillers: ClassifiedFillerEntry[],
    metrics: NonNullable<RoleContext["metrics"]>,
    wordOfTheDay: string | null,
    context: RoleContext,
  ): StructuredReport {
    const sections: ReportSection[] = [];

    // Summary section
    const trueFillers = classifiedFillers.filter((f) => f.classification === "true_filler");
    const discourseMarkers = classifiedFillers.filter((f) => f.classification === "discourse_marker");
    const totalTrue = trueFillers.reduce((sum, f) => sum + f.count, 0);
    const totalDiscourse = discourseMarkers.reduce((sum, f) => sum + f.count, 0);

    sections.push({
      heading: "Summary",
      content: [
        `Total filler words: ${metrics.fillerWordCount}`,
        `Filler word frequency: ${metrics.fillerWordFrequency.toFixed(1)} per minute`,
        `True fillers: ${totalTrue}`,
        `Discourse markers: ${totalDiscourse}`,
        `Speech duration: ${metrics.durationFormatted}`,
      ].join("\n"),
    });

    // Breakdown by word
    if (fillerWords.length > 0) {
      const lines = fillerWords
        .sort((a, b) => b.count - a.count)
        .map((fw) => `"${fw.word}": ${fw.count} time${fw.count === 1 ? "" : "s"}`);

      sections.push({
        heading: "Filler Word Breakdown",
        content: lines.join("\n"),
      });
    }

    // Timestamps section (top 3 most frequent)
    const top3 = fillerWords
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (top3.length > 0) {
      const lines = top3.map((fw) => {
        const times = fw.timestamps
          .slice(0, 5)
          .map((t) => formatTime(t))
          .join(", ");
        const moreCount = fw.timestamps.length > 5 ? ` (+${fw.timestamps.length - 5} more)` : "";
        return `"${fw.word}" at: ${times}${moreCount}`;
      });

      sections.push({
        heading: "When They Occurred",
        content: lines.join("\n"),
      });
    }

    // Word of the Day tracking
    if (wordOfTheDay) {
      const wodCount = countWordOfTheDay(wordOfTheDay, context.transcript);
      sections.push({
        heading: "Word of the Day",
        content: `"${wordOfTheDay}": used ${wodCount} time${wodCount === 1 ? "" : "s"}`,
      });
    }

    return {
      title: "Ah-Counter Report",
      sections,
      data: {
        fillerWordCount: metrics.fillerWordCount,
        fillerWordFrequency: metrics.fillerWordFrequency,
        trueFillerCount: totalTrue,
        discourseMarkerCount: totalDiscourse,
        fillerWords: fillerWords.map((fw) => ({ word: fw.word, count: fw.count })),
        ...(wordOfTheDay ? { wordOfTheDay, wordOfTheDayCount: countWordOfTheDay(wordOfTheDay, context.transcript) } : {}),
      },
    };
  }

  // ─── Script Rendering ────────────────────────────────────────────────────

  private renderScript(
    fillerWords: FillerWordEntry[],
    classifiedFillers: ClassifiedFillerEntry[],
    metrics: NonNullable<RoleContext["metrics"]>,
    wordOfTheDay: string | null,
    context: RoleContext,
  ): string {
    const parts: string[] = [];
    const speakerRef = context.speakerName ? context.speakerName : "the speaker";

    // Opening
    if (metrics.fillerWordCount === 0) {
      parts.push(`As Ah-Counter, I'm pleased to report that ${speakerRef} used no filler words during this ${metrics.durationFormatted} speech. That's excellent control!`);
    } else {
      parts.push(`As Ah-Counter for this ${metrics.durationFormatted} speech, I tracked ${metrics.fillerWordCount} filler word${metrics.fillerWordCount === 1 ? "" : "s"}, which works out to ${metrics.fillerWordFrequency.toFixed(1)} per minute.`);
    }

    // Detail the top fillers
    const sorted = [...fillerWords].sort((a, b) => b.count - a.count);
    if (sorted.length > 0) {
      const details = sorted.slice(0, 3).map((fw) =>
        `${fw.count} instance${fw.count === 1 ? "" : "s"} of "${fw.word}"`,
      );

      if (details.length === 1) {
        parts.push(`Specifically, I counted ${details[0]}.`);
      } else if (details.length === 2) {
        parts.push(`Specifically, I counted ${details[0]} and ${details[1]}.`);
      } else {
        parts.push(`Specifically, I counted ${details.slice(0, -1).join(", ")}, and ${details[details.length - 1]}.`);
      }
    }

    // True filler vs discourse marker distinction
    const trueFillers = classifiedFillers.filter((f) => f.classification === "true_filler");
    const discourseMarkers = classifiedFillers.filter((f) => f.classification === "discourse_marker");
    const totalTrue = trueFillers.reduce((sum, f) => sum + f.count, 0);
    const totalDiscourse = discourseMarkers.reduce((sum, f) => sum + f.count, 0);

    if (totalTrue > 0 && totalDiscourse > 0) {
      parts.push(`Of these, ${totalTrue} ${totalTrue === 1 ? "was a" : "were"} true filler${totalTrue === 1 ? "" : "s"} like "um" or "uh", and ${totalDiscourse} ${totalDiscourse === 1 ? "was a" : "were"} discourse marker${totalDiscourse === 1 ? "" : "s"} like "you know" or "so".`);
    }

    // Word of the Day
    if (wordOfTheDay) {
      const wodCount = countWordOfTheDay(wordOfTheDay, context.transcript);
      if (wodCount > 0) {
        parts.push(`As for our Word of the Day, "${wordOfTheDay}", it was used ${wodCount} time${wodCount === 1 ? "" : "s"} during the speech. Well done!`);
      } else {
        parts.push(`I didn't catch our Word of the Day, "${wordOfTheDay}", during this speech. Something to keep in mind for next time!`);
      }
    }

    return parts.join(" ");
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Format seconds into M:SS for spoken output.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Count how many times a Word of the Day appears in the transcript.
 * Case-insensitive whole-word matching.
 */
export function countWordOfTheDay(
  word: string,
  transcript: RoleContext["transcript"],
): number {
  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
  let count = 0;
  for (const segment of transcript) {
    const matches = segment.text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
