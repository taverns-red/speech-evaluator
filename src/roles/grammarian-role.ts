/**
 * AI Grammarian — LLM-based grammar analysis and vocabulary tracking.
 *
 * The Grammarian is a standard Toastmasters meeting role that monitors
 * grammar usage, highlights impressive vocabulary, and tracks the
 * Word of the Day.
 *
 * This is an LLM-based role — it sends the transcript to an LLM for
 * grammar analysis and receives structured JSON back. Falls back to
 * a "grammar analysis unavailable" report on LLM failure.
 *
 * Issue: #75
 */

import type { MeetingRole, RoleContext, RoleResult, StructuredReport, ReportSection } from "../meeting-role.js";
import { countWordOfTheDay } from "./ah-counter-role.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_ID = "grammarian";
const ROLE_NAME = "Grammarian";
const ROLE_DESCRIPTION = "Analyzes grammar, highlights vocabulary, and tracks Word of the Day usage.";

// ─── LLM Call Interface ─────────────────────────────────────────────────────────

/**
 * Generic LLM call function — takes a prompt, returns a response string.
 * Injected via RoleContext.config.llmCall for testability.
 */
export type LLMCallFn = (prompt: string) => Promise<string>;

// ─── LLM Response Shape ─────────────────────────────────────────────────────────

interface GrammarNote {
  issue: string;
  example: string;
  suggestion: string;
}

interface GrammarAnalysis {
  grammarNotes: GrammarNote[];
  vocabularyHighlights: string[];
  overallImpression: string;
  recommendations: string[];
}

// ─── Grammarian Role ────────────────────────────────────────────────────────────

export class GrammarianRole implements MeetingRole {
  readonly id = ROLE_ID;
  readonly name = ROLE_NAME;
  readonly description = ROLE_DESCRIPTION;
  readonly requiredInputs = ["transcript"] as const;

  async run(context: RoleContext): Promise<RoleResult> {
    const { transcript, config } = context;

    if (!transcript || transcript.length === 0) {
      throw new Error("Grammarian requires a non-empty transcript.");
    }

    const llmCall = config.llmCall as LLMCallFn | undefined;
    if (!llmCall || typeof llmCall !== "function") {
      throw new Error("Grammarian requires an llmCall function in config.");
    }

    const wordOfTheDay = typeof config.wordOfTheDay === "string" ? config.wordOfTheDay : null;
    const transcriptText = transcript.map(s => s.text).join(" ");

    // Call LLM with fallback on failure
    let analysis: GrammarAnalysis | null = null;
    try {
      const prompt = this.buildPrompt(transcriptText, wordOfTheDay);
      const response = await llmCall(prompt);
      analysis = this.parseResponse(response);
    } catch {
      // LLM failure — will produce fallback report
    }

    const wodCount = wordOfTheDay ? countWordOfTheDay(wordOfTheDay, transcript) : null;
    const report = analysis
      ? this.buildReport(analysis, wordOfTheDay, wodCount)
      : this.buildFallbackReport(wordOfTheDay, wodCount);
    const script = analysis
      ? this.renderScript(analysis, wordOfTheDay, wodCount, context)
      : this.renderFallbackScript(context);

    return {
      roleId: this.id,
      report,
      script,
    };
  }

  // ─── Prompt Building ──────────────────────────────────────────────────────

  private buildPrompt(transcriptText: string, wordOfTheDay: string | null): string {
    const wodInstruction = wordOfTheDay
      ? `\n\nThe Word of the Day is "${wordOfTheDay}". Note any uses of this word or related forms.`
      : "";

    return `You are a Toastmasters Grammarian analyzing a speech transcript.

Analyze the following speech transcript for grammar and vocabulary.

TRANSCRIPT:
"""
${transcriptText}
"""${wodInstruction}

Respond with a JSON object (no markdown fences) containing:
{
  "grammarNotes": [
    { "issue": "description of the grammar issue", "example": "the problematic phrase from the transcript", "suggestion": "the corrected version" }
  ],
  "vocabularyHighlights": ["description of impressive word choices or phrasing"],
  "overallImpression": "1-2 sentence overall assessment of grammar and vocabulary quality",
  "recommendations": ["actionable improvement suggestions"]
}

Rules:
- Only flag genuine grammar issues, not stylistic preferences
- Highlight at least 2 vocabulary strengths if they exist
- Keep recommendations constructive and specific
- If grammar is excellent, return an empty grammarNotes array`;
  }

  // ─── Response Parsing ─────────────────────────────────────────────────────

  private parseResponse(response: string): GrammarAnalysis {
    // Strip markdown code fences if present
    const cleaned = response.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate shape
    if (!Array.isArray(parsed.grammarNotes) || !Array.isArray(parsed.vocabularyHighlights)) {
      throw new Error("Invalid GrammarAnalysis shape");
    }

    return {
      grammarNotes: parsed.grammarNotes ?? [],
      vocabularyHighlights: parsed.vocabularyHighlights ?? [],
      overallImpression: parsed.overallImpression ?? "",
      recommendations: parsed.recommendations ?? [],
    };
  }

  // ─── Report Building ──────────────────────────────────────────────────────

  private buildReport(
    analysis: GrammarAnalysis,
    wordOfTheDay: string | null,
    wodCount: number | null,
  ): StructuredReport {
    const sections: ReportSection[] = [];

    // Overall Impression
    if (analysis.overallImpression) {
      sections.push({
        heading: "Overall Impression",
        content: analysis.overallImpression,
      });
    }

    // Grammar Notes
    if (analysis.grammarNotes.length > 0) {
      const lines = analysis.grammarNotes.map(note =>
        `• ${note.issue}\n  Example: "${note.example}"\n  Suggestion: "${note.suggestion}"`,
      );
      sections.push({
        heading: "Grammar Notes",
        content: lines.join("\n\n"),
      });
    } else {
      sections.push({
        heading: "Grammar Notes",
        content: "No grammar issues noted — excellent grammar throughout!",
      });
    }

    // Vocabulary Highlights
    if (analysis.vocabularyHighlights.length > 0) {
      sections.push({
        heading: "Vocabulary Highlights",
        content: analysis.vocabularyHighlights.map(h => `• ${h}`).join("\n"),
      });
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      sections.push({
        heading: "Recommendations",
        content: analysis.recommendations.map(r => `• ${r}`).join("\n"),
      });
    }

    // Word of the Day
    if (wordOfTheDay && wodCount !== null) {
      sections.push({
        heading: "Word of the Day",
        content: `"${wordOfTheDay}": used ${wodCount} time${wodCount === 1 ? "" : "s"}`,
      });
    }

    return {
      title: "Grammarian Report",
      sections,
      data: {
        grammarIssueCount: analysis.grammarNotes.length,
        vocabularyHighlightCount: analysis.vocabularyHighlights.length,
        ...(wordOfTheDay ? { wordOfTheDay, wordOfTheDayCount: wodCount } : {}),
      },
    };
  }

  private buildFallbackReport(wordOfTheDay: string | null, wodCount: number | null): StructuredReport {
    const sections: ReportSection[] = [
      {
        heading: "Status",
        content: "Grammar analysis unavailable — the language model could not be reached or returned an invalid response.",
      },
    ];

    if (wordOfTheDay && wodCount !== null) {
      sections.push({
        heading: "Word of the Day",
        content: `"${wordOfTheDay}": used ${wodCount} time${wodCount === 1 ? "" : "s"}`,
      });
    }

    return {
      title: "Grammarian Report",
      sections,
      data: { error: true },
    };
  }

  // ─── Script Rendering ─────────────────────────────────────────────────────

  private renderScript(
    analysis: GrammarAnalysis,
    wordOfTheDay: string | null,
    wodCount: number | null,
    context: RoleContext,
  ): string {
    const parts: string[] = [];
    const speakerRef = context.speakerName ?? "the speaker";

    // Opening
    parts.push(`As Grammarian, I reviewed ${speakerRef}'s speech for grammar and vocabulary.`);

    // Overall impression
    if (analysis.overallImpression) {
      parts.push(analysis.overallImpression);
    }

    // Grammar issues summary
    if (analysis.grammarNotes.length === 0) {
      parts.push("I found no grammar issues — well done!");
    } else {
      parts.push(`I noted ${analysis.grammarNotes.length} grammar point${analysis.grammarNotes.length === 1 ? "" : "s"}.`);
      // Mention top 2 issues at most
      const topIssues = analysis.grammarNotes.slice(0, 2);
      for (const note of topIssues) {
        parts.push(`${note.issue}: instead of "${note.example}", consider "${note.suggestion}".`);
      }
    }

    // Vocabulary
    if (analysis.vocabularyHighlights.length > 0) {
      parts.push(`On the positive side, ${analysis.vocabularyHighlights[0]}.`);
    }

    // Word of the Day
    if (wordOfTheDay && wodCount !== null) {
      if (wodCount > 0) {
        parts.push(`Our Word of the Day, "${wordOfTheDay}", was used ${wodCount} time${wodCount === 1 ? "" : "s"}.`);
      } else {
        parts.push(`I didn't catch our Word of the Day, "${wordOfTheDay}", in this speech.`);
      }
    }

    return parts.join(" ");
  }

  private renderFallbackScript(context: RoleContext): string {
    const speakerRef = context.speakerName ?? "the speaker";
    return `As Grammarian, I was unable to complete the grammar analysis for ${speakerRef}'s speech due to a technical issue. The written report has more details.`;
  }
}
