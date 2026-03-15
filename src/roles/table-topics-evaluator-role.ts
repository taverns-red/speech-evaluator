/**
 * AI Table Topics Evaluator — brief evaluation of impromptu responses.
 *
 * Evaluates short impromptu speeches (Table Topics) using the LLM.
 * Focuses on structure, confidence, relevance to the topic, and
 * time management for 1-2 minute responses.
 *
 * Issue: #77
 */

import type { MeetingRole, RoleContext, RoleResult, StructuredReport, ReportSection } from "../meeting-role.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_ID = "table-topics-evaluator";
const ROLE_NAME = "Table Topics Evaluator";
const ROLE_DESCRIPTION = "Evaluates impromptu speech responses for structure, relevance, and delivery.";

// ─── LLM Call Interface ─────────────────────────────────────────────────────────

export type LLMCallFn = (prompt: string) => Promise<string>;

// ─── LLM Response Shape ─────────────────────────────────────────────────────────

interface TopicsEvaluation {
  relevance: { score: number; feedback: string };
  structure: { score: number; feedback: string };
  confidence: { score: number; feedback: string };
  timeManagement: { score: number; feedback: string };
  overallFeedback: string;
  strengths: string[];
  areasForGrowth: string[];
}

// ─── Table Topics Evaluator Role ────────────────────────────────────────────────

export class TableTopicsEvaluatorRole implements MeetingRole {
  readonly id = ROLE_ID;
  readonly name = ROLE_NAME;
  readonly description = ROLE_DESCRIPTION;
  readonly requiredInputs = ["transcript"] as const;

  async run(context: RoleContext): Promise<RoleResult> {
    const { transcript, metrics, config } = context;

    if (!transcript || transcript.length === 0) {
      throw new Error("Table Topics Evaluator requires a non-empty transcript.");
    }

    const llmCall = config.llmCall as LLMCallFn | undefined;
    if (!llmCall || typeof llmCall !== "function") {
      throw new Error("Table Topics Evaluator requires an llmCall function in config.");
    }

    const topicQuestion = typeof config.topicQuestion === "string" ? config.topicQuestion : null;
    const transcriptText = transcript.map(s => s.text).join(" ");
    const durationSec = metrics?.durationSeconds ?? 0;

    let evaluation: TopicsEvaluation | null = null;
    try {
      const prompt = this.buildPrompt(transcriptText, durationSec, topicQuestion);
      const response = await llmCall(prompt);
      evaluation = this.parseResponse(response);
    } catch {
      // LLM failure
    }

    const report = evaluation
      ? this.buildReport(evaluation, durationSec)
      : this.buildFallbackReport();
    const script = evaluation
      ? this.renderScript(evaluation, context)
      : this.renderFallbackScript(context);

    return { roleId: this.id, report, script };
  }

  private buildPrompt(text: string, durationSec: number, topic: string | null): string {
    const topicLine = topic
      ? `\n\nThe Table Topic question was: "${topic}"`
      : "";

    return `You are a Toastmasters Table Topics Evaluator analyzing an impromptu speech response.${topicLine}

The speech lasted ${Math.round(durationSec)} seconds (target: 60-120 seconds).

TRANSCRIPT:
"""
${text}
"""

Respond with a JSON object (no markdown fences):
{
  "relevance": { "score": 8, "feedback": "How well the response addressed the topic" },
  "structure": { "score": 7, "feedback": "Whether the response had a clear opening, body, and conclusion" },
  "confidence": { "score": 8, "feedback": "Assessment of vocal confidence and poise" },
  "timeManagement": { "score": 6, "feedback": "How well the speaker used the 1-2 minute window" },
  "overallFeedback": "2-3 sentence overall assessment",
  "strengths": ["specific things done well"],
  "areasForGrowth": ["specific improvement suggestions"]
}

Rules:
- Scores are 1-10
- Be encouraging but honest
- Focus on impromptu-specific skills (thinking on feet, structured response)
- Keep feedback concise — this is a brief evaluation`;
  }

  private parseResponse(response: string): TopicsEvaluation {
    const cleaned = response.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.relevance || !parsed.structure) throw new Error("Invalid TopicsEvaluation shape");
    return parsed as TopicsEvaluation;
  }

  private buildReport(evaluation: TopicsEvaluation, durationSec: number): StructuredReport {
    const sections: ReportSection[] = [];

    // Scores grid
    const scores = [
      `Relevance: ${evaluation.relevance.score}/10 — ${evaluation.relevance.feedback}`,
      `Structure: ${evaluation.structure.score}/10 — ${evaluation.structure.feedback}`,
      `Confidence: ${evaluation.confidence.score}/10 — ${evaluation.confidence.feedback}`,
      `Time Management: ${evaluation.timeManagement.score}/10 — ${evaluation.timeManagement.feedback}`,
    ];
    sections.push({ heading: "Scores", content: scores.join("\n") });

    sections.push({ heading: "Overall", content: evaluation.overallFeedback });

    if (evaluation.strengths.length > 0) {
      sections.push({ heading: "Strengths", content: evaluation.strengths.map(s => `• ${s}`).join("\n") });
    }

    if (evaluation.areasForGrowth.length > 0) {
      sections.push({ heading: "Areas for Growth", content: evaluation.areasForGrowth.map(a => `• ${a}`).join("\n") });
    }

    const avgScore = Math.round(
      (evaluation.relevance.score + evaluation.structure.score +
       evaluation.confidence.score + evaluation.timeManagement.score) / 4 * 10,
    ) / 10;

    return {
      title: "Table Topics Evaluation",
      sections,
      data: { averageScore: avgScore, durationSeconds: durationSec },
    };
  }

  private buildFallbackReport(): StructuredReport {
    return {
      title: "Table Topics Evaluation",
      sections: [{ heading: "Status", content: "Evaluation unavailable — the language model could not be reached." }],
      data: { error: true },
    };
  }

  private renderScript(evaluation: TopicsEvaluation, context: RoleContext): string {
    const speaker = context.speakerName ?? "the speaker";
    const parts = [`As Table Topics Evaluator, I evaluated ${speaker}'s impromptu response.`];
    parts.push(evaluation.overallFeedback);
    if (evaluation.strengths.length > 0) {
      parts.push(`A key strength was: ${evaluation.strengths[0]}.`);
    }
    if (evaluation.areasForGrowth.length > 0) {
      parts.push(`One area to work on: ${evaluation.areasForGrowth[0]}.`);
    }
    return parts.join(" ");
  }

  private renderFallbackScript(context: RoleContext): string {
    const speaker = context.speakerName ?? "the speaker";
    return `As Table Topics Evaluator, I was unable to complete the evaluation for ${speaker}'s response due to a technical issue.`;
  }
}
