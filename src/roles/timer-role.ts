/**
 * AI Timer — deterministic speech timing analysis and pacing report.
 *
 * The Timer is a standard Toastmasters meeting role that tracks whether
 * a speaker stays within their allotted time and reports on pacing.
 *
 * This is a deterministic role — no LLM calls required. All data is
 * derived from DeliveryMetrics (duration, WPM, pauses).
 *
 * Issue: #74
 */

import type { MeetingRole, RoleContext, RoleResult, StructuredReport, ReportSection } from "../meeting-role.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_ID = "timer";
const ROLE_NAME = "Timer";
const ROLE_DESCRIPTION = "Tracks speech duration against target time, reports on pacing and pause usage.";

/** Default target range: 5–7 minutes (Toastmasters Ice Breaker / standard speech). */
const DEFAULT_MIN_SECONDS = 300;
const DEFAULT_MAX_SECONDS = 420;

/** Buffer zone around target range — within this margin is "yellow" rather than "red". */
const YELLOW_BUFFER_SECONDS = 30;

// ─── Pacing Zones ───────────────────────────────────────────────────────────────

type TimingZone = "green" | "yellow" | "red";

interface PacingClassification {
  label: string;
  description: string;
}

function classifyPacing(wpm: number): PacingClassification {
  if (wpm < 100) return { label: "Slow", description: "below 100 WPM — may feel sluggish" };
  if (wpm < 120) return { label: "Deliberate", description: "100–120 WPM — measured and thoughtful" };
  if (wpm <= 160) return { label: "Conversational", description: "120–160 WPM — natural and engaging" };
  if (wpm <= 180) return { label: "Brisk", description: "160–180 WPM — energetic but may rush key points" };
  return { label: "Rapid", description: "above 180 WPM — likely too fast for audience retention" };
}

// ─── Timer Role ─────────────────────────────────────────────────────────────────

export class TimerRole implements MeetingRole {
  readonly id = ROLE_ID;
  readonly name = ROLE_NAME;
  readonly description = ROLE_DESCRIPTION;
  readonly requiredInputs = ["metrics"] as const;

  async run(context: RoleContext): Promise<RoleResult> {
    const { metrics } = context;

    if (!metrics) {
      throw new Error("Timer requires metrics data.");
    }

    const minTarget = typeof context.config.targetMinSeconds === "number"
      ? context.config.targetMinSeconds
      : DEFAULT_MIN_SECONDS;
    const maxTarget = typeof context.config.targetMaxSeconds === "number"
      ? context.config.targetMaxSeconds
      : DEFAULT_MAX_SECONDS;

    const zone = this.classifyZone(metrics.durationSeconds, minTarget, maxTarget);
    const report = this.buildReport(metrics, zone, minTarget, maxTarget);
    const script = this.renderScript(metrics, zone, minTarget, maxTarget, context);

    return {
      roleId: this.id,
      report,
      script,
    };
  }

  // ─── Zone Classification ──────────────────────────────────────────────────

  private classifyZone(durationSeconds: number, minTarget: number, maxTarget: number): TimingZone {
    // Green: within target range (inclusive)
    if (durationSeconds >= minTarget && durationSeconds <= maxTarget) {
      return "green";
    }

    // Yellow: within YELLOW_BUFFER of either boundary
    if (
      (durationSeconds >= minTarget - YELLOW_BUFFER_SECONDS && durationSeconds < minTarget) ||
      (durationSeconds > maxTarget && durationSeconds <= maxTarget + YELLOW_BUFFER_SECONDS)
    ) {
      return "yellow";
    }

    // Red: outside both target and buffer
    return "red";
  }

  // ─── Report Building ──────────────────────────────────────────────────────

  private buildReport(
    metrics: NonNullable<RoleContext["metrics"]>,
    zone: TimingZone,
    minTarget: number,
    maxTarget: number,
  ): StructuredReport {
    const sections: ReportSection[] = [];

    // Timing Summary
    const zoneEmoji = zone === "green" ? "🟢" : zone === "yellow" ? "🟡" : "🔴";
    const targetRange = `${formatDuration(minTarget)} – ${formatDuration(maxTarget)}`;
    const overUnder = metrics.durationSeconds < minTarget
      ? `${formatDuration(minTarget - metrics.durationSeconds)} under minimum`
      : metrics.durationSeconds > maxTarget
        ? `${formatDuration(metrics.durationSeconds - maxTarget)} over maximum`
        : "within target range";

    sections.push({
      heading: "Timing Summary",
      content: [
        `Duration: ${metrics.durationFormatted} ${zoneEmoji}`,
        `Target range: ${targetRange}`,
        `Status: ${overUnder}`,
      ].join("\n"),
    });

    // Pacing
    const pacing = classifyPacing(metrics.wordsPerMinute);
    sections.push({
      heading: "Pacing",
      content: [
        `Words per minute: ${metrics.wordsPerMinute} (${pacing.label})`,
        `Total words: ${metrics.totalWords}`,
        pacing.description,
      ].join("\n"),
    });

    // Pause Analysis (only if pauses exist)
    if (metrics.pauseCount > 0) {
      sections.push({
        heading: "Pause Analysis",
        content: [
          `Total pauses: ${metrics.pauseCount}`,
          `Intentional: ${metrics.intentionalPauseCount}`,
          `Hesitation: ${metrics.hesitationPauseCount}`,
          `Total pause time: ${metrics.totalPauseDurationSeconds.toFixed(1)}s`,
          `Average pause: ${metrics.averagePauseDurationSeconds.toFixed(1)}s`,
        ].join("\n"),
      });
    }

    return {
      title: "Timer Report",
      sections,
      data: {
        durationSeconds: metrics.durationSeconds,
        wordsPerMinute: metrics.wordsPerMinute,
        zone,
        targetMinSeconds: minTarget,
        targetMaxSeconds: maxTarget,
        pauseCount: metrics.pauseCount,
        intentionalPauseCount: metrics.intentionalPauseCount,
        hesitationPauseCount: metrics.hesitationPauseCount,
      },
    };
  }

  // ─── Script Rendering ─────────────────────────────────────────────────────

  private renderScript(
    metrics: NonNullable<RoleContext["metrics"]>,
    zone: TimingZone,
    minTarget: number,
    maxTarget: number,
    context: RoleContext,
  ): string {
    const parts: string[] = [];
    const speakerRef = context.speakerName ?? "the speaker";
    const targetRange = `${formatDuration(minTarget)} to ${formatDuration(maxTarget)}`;

    // Opening — zone-dependent
    if (zone === "green") {
      parts.push(`As Timer, I'm pleased to report that ${speakerRef}'s speech came in at ${metrics.durationFormatted}, which is right within our target range of ${targetRange}. Excellent time management!`);
    } else if (zone === "yellow") {
      const direction = metrics.durationSeconds < minTarget ? "slightly under" : "slightly over";
      parts.push(`As Timer, ${speakerRef}'s speech came in at ${metrics.durationFormatted}, which is ${direction} our target range of ${targetRange}. Close, but something to be aware of for next time.`);
    } else {
      const direction = metrics.durationSeconds < minTarget ? "well under" : "well over";
      parts.push(`As Timer, ${speakerRef}'s speech came in at ${metrics.durationFormatted}, which is ${direction} our target range of ${targetRange}.`);
    }

    // Pacing commentary
    const pacing = classifyPacing(metrics.wordsPerMinute);
    parts.push(`The pacing was ${pacing.label.toLowerCase()} at ${metrics.wordsPerMinute} words per minute.`);

    // Pause commentary (brief)
    if (metrics.pauseCount > 0 && metrics.intentionalPauseCount > 0) {
      parts.push(`I noted ${metrics.intentionalPauseCount} intentional pause${metrics.intentionalPauseCount === 1 ? "" : "s"}, which ${metrics.intentionalPauseCount === 1 ? "was" : "were"} used effectively.`);
    }

    return parts.join(" ");
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────────

/**
 * Format seconds into human-readable duration (e.g., "5:30", "0:45").
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
