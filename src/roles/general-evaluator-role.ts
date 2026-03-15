/**
 * AI General Evaluator — meeting-level evaluation and summary.
 *
 * The General Evaluator provides an overall assessment of the meeting,
 * summarizing individual role reports and providing meeting-level
 * observations and recommendations.
 *
 * This role consumes other role results via config.roleResults, making
 * it a meta-role that synthesizes all other feedback.
 *
 * Issue: #78
 */

import type { MeetingRole, RoleContext, RoleResult, StructuredReport, ReportSection } from "../meeting-role.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_ID = "general-evaluator";
const ROLE_NAME = "General Evaluator";
const ROLE_DESCRIPTION = "Provides meeting-level evaluation summarizing all role reports and overall observations.";

// ─── LLM Call Interface ─────────────────────────────────────────────────────────

export type LLMCallFn = (prompt: string) => Promise<string>;

// ─── LLM Response Shape ─────────────────────────────────────────────────────────

interface GeneralEvaluation {
  meetingSummary: string;
  highlights: string[];
  areasForImprovement: string[];
  rolePerformanceSummary: string;
  recommendations: string[];
  closingRemarks: string;
}

// ─── General Evaluator Role ─────────────────────────────────────────────────────

export class GeneralEvaluatorRole implements MeetingRole {
  readonly id = ROLE_ID;
  readonly name = ROLE_NAME;
  readonly description = ROLE_DESCRIPTION;
  readonly requiredInputs = ["transcript"] as const;

  async run(context: RoleContext): Promise<RoleResult> {
    const { transcript, metrics, config } = context;

    if (!transcript || transcript.length === 0) {
      throw new Error("General Evaluator requires a non-empty transcript.");
    }

    const llmCall = config.llmCall as LLMCallFn | undefined;
    if (!llmCall || typeof llmCall !== "function") {
      throw new Error("General Evaluator requires an llmCall function in config.");
    }

    const transcriptText = transcript.map(s => s.text).join(" ");
    const roleResults = Array.isArray(config.roleResults) ? config.roleResults : [];
    const durationSec = metrics?.durationSeconds ?? 0;

    let evaluation: GeneralEvaluation | null = null;
    try {
      const prompt = this.buildPrompt(transcriptText, durationSec, roleResults);
      const response = await llmCall(prompt);
      evaluation = this.parseResponse(response);
    } catch {
      // LLM failure
    }

    const report = evaluation
      ? this.buildReport(evaluation)
      : this.buildFallbackReport();
    const script = evaluation
      ? this.renderScript(evaluation, context)
      : this.renderFallbackScript(context);

    return { roleId: this.id, report, script };
  }

  private buildPrompt(text: string, durationSec: number, roleResults: unknown[]): string {
    let roleContext = "";
    if (roleResults.length > 0) {
      const summaries = roleResults.map((r: unknown) => {
        const role = r as { roleId?: string; report?: { title?: string; sections?: Array<{ heading?: string; content?: string }> } };
        const title = role.report?.title ?? role.roleId ?? "Unknown";
        const content = role.report?.sections?.map(s => `${s.heading}: ${s.content}`).join("\n") ?? "";
        return `--- ${title} ---\n${content}`;
      });
      roleContext = `\n\nOther role reports from this meeting:\n${summaries.join("\n\n")}`;
    }

    return `You are a Toastmasters General Evaluator providing an overall meeting assessment.

The meeting lasted ${Math.round(durationSec / 60)} minutes.

TRANSCRIPT:
"""
${text.slice(0, 3000)}
"""${roleContext}

Respond with a JSON object (no markdown fences):
{
  "meetingSummary": "2-3 sentence overview of the meeting",
  "highlights": ["notable positive moments"],
  "areasForImprovement": ["constructive suggestions for the meeting"],
  "rolePerformanceSummary": "1-2 sentences on how the various role-holders performed",
  "recommendations": ["actionable recommendations for future meetings"],
  "closingRemarks": "1-2 sentence encouraging close"
}

Rules:
- Be constructive and encouraging
- Reference specific moments from the transcript when possible
- If role reports are provided, synthesize their findings
- Keep the tone professional and supportive`;
  }

  private parseResponse(response: string): GeneralEvaluation {
    const cleaned = response.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.meetingSummary) throw new Error("Invalid GeneralEvaluation shape");
    return {
      meetingSummary: parsed.meetingSummary ?? "",
      highlights: parsed.highlights ?? [],
      areasForImprovement: parsed.areasForImprovement ?? [],
      rolePerformanceSummary: parsed.rolePerformanceSummary ?? "",
      recommendations: parsed.recommendations ?? [],
      closingRemarks: parsed.closingRemarks ?? "",
    };
  }

  private buildReport(evaluation: GeneralEvaluation): StructuredReport {
    const sections: ReportSection[] = [];

    sections.push({ heading: "Meeting Summary", content: evaluation.meetingSummary });

    if (evaluation.highlights.length > 0) {
      sections.push({ heading: "Highlights", content: evaluation.highlights.map(h => `• ${h}`).join("\n") });
    }

    if (evaluation.rolePerformanceSummary) {
      sections.push({ heading: "Role Performance", content: evaluation.rolePerformanceSummary });
    }

    if (evaluation.areasForImprovement.length > 0) {
      sections.push({ heading: "Areas for Improvement", content: evaluation.areasForImprovement.map(a => `• ${a}`).join("\n") });
    }

    if (evaluation.recommendations.length > 0) {
      sections.push({ heading: "Recommendations", content: evaluation.recommendations.map(r => `• ${r}`).join("\n") });
    }

    if (evaluation.closingRemarks) {
      sections.push({ heading: "Closing", content: evaluation.closingRemarks });
    }

    return {
      title: "General Evaluator Report",
      sections,
      data: { highlightCount: evaluation.highlights.length },
    };
  }

  private buildFallbackReport(): StructuredReport {
    return {
      title: "General Evaluator Report",
      sections: [{ heading: "Status", content: "Meeting evaluation unavailable — the language model could not be reached." }],
      data: { error: true },
    };
  }

  private renderScript(evaluation: GeneralEvaluation, context: RoleContext): string {
    const parts = ["As General Evaluator, here is my overall assessment of today's meeting."];
    parts.push(evaluation.meetingSummary);
    if (evaluation.highlights.length > 0) {
      parts.push(`A standout moment was: ${evaluation.highlights[0]}.`);
    }
    if (evaluation.recommendations.length > 0) {
      parts.push(`My recommendation: ${evaluation.recommendations[0]}.`);
    }
    if (evaluation.closingRemarks) {
      parts.push(evaluation.closingRemarks);
    }
    return parts.join(" ");
  }

  private renderFallbackScript(context: RoleContext): string {
    return "As General Evaluator, I was unable to complete the meeting evaluation due to a technical issue. The written report has more details.";
  }
}
