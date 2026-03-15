/**
 * AI Table Topics Master — themed impromptu speaking prompt generation.
 *
 * Generates creative, themed impromptu speaking prompts (Table Topics)
 * using the LLM. Can optionally be given a theme to constrain prompt
 * generation.
 *
 * This role doesn't need a transcript or metrics — it generates content
 * independently, making it unique among the meeting roles.
 *
 * Issue: #76
 */

import type { MeetingRole, RoleContext, RoleResult, StructuredReport, ReportSection } from "../meeting-role.js";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_ID = "table-topics-master";
const ROLE_NAME = "Table Topics Master";
const ROLE_DESCRIPTION = "Generates creative impromptu speaking prompts (Table Topics) with optional theming.";
const DEFAULT_PROMPT_COUNT = 5;

// ─── LLM Call Interface ─────────────────────────────────────────────────────────

export type LLMCallFn = (prompt: string) => Promise<string>;

// ─── LLM Response Shape ─────────────────────────────────────────────────────────

interface TopicPrompt {
  topic: string;
  context: string;
  suggestedTimeMinutes: number;
}

interface TopicsResponse {
  theme: string;
  prompts: TopicPrompt[];
  introScript: string;
}

// ─── Table Topics Master Role ───────────────────────────────────────────────────

export class TableTopicsMasterRole implements MeetingRole {
  readonly id = ROLE_ID;
  readonly name = ROLE_NAME;
  readonly description = ROLE_DESCRIPTION;
  readonly requiredInputs = [] as const;

  async run(context: RoleContext): Promise<RoleResult> {
    const { config } = context;

    const llmCall = config.llmCall as LLMCallFn | undefined;
    if (!llmCall || typeof llmCall !== "function") {
      throw new Error("Table Topics Master requires an llmCall function in config.");
    }

    const theme = typeof config.theme === "string" ? config.theme : null;
    const promptCount = typeof config.promptCount === "number" ? config.promptCount : DEFAULT_PROMPT_COUNT;

    let topics: TopicsResponse | null = null;
    try {
      const prompt = this.buildPrompt(theme, promptCount);
      const response = await llmCall(prompt);
      topics = this.parseResponse(response);
    } catch {
      // LLM failure — fallback
    }

    const report = topics
      ? this.buildReport(topics)
      : this.buildFallbackReport(theme);
    const script = topics
      ? topics.introScript
      : `As Table Topics Master, I have prepared some impromptu speaking topics for today's meeting. Unfortunately, the topic generation encountered a technical issue.`;

    return { roleId: this.id, report, script };
  }

  private buildPrompt(theme: string | null, count: number): string {
    const themeInstruction = theme
      ? `\n\nThe theme for today's Table Topics is: "${theme}". All prompts should relate to this theme.`
      : "\n\nChoose a creative theme and generate prompts around it.";

    return `You are a Toastmasters Table Topics Master. Generate ${count} impromptu speaking prompts.${themeInstruction}

Respond with a JSON object (no markdown fences):
{
  "theme": "the theme chosen or given",
  "prompts": [
    { "topic": "the speaking prompt question", "context": "brief context or follow-up to help the speaker", "suggestedTimeMinutes": 1.5 }
  ],
  "introScript": "A 2-3 sentence introduction script for the Table Topics Master to read aloud, introducing the theme and inviting participation"
}

Rules:
- Each prompt should be an open-ended question that encourages storytelling
- Prompts should be appropriate for a professional setting
- Suggested time should be 1-2 minutes per topic
- The intro script should be warm and engaging`;
  }

  private parseResponse(response: string): TopicsResponse {
    const cleaned = response.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.prompts)) throw new Error("Invalid TopicsResponse shape");
    return {
      theme: parsed.theme ?? "General",
      prompts: parsed.prompts ?? [],
      introScript: parsed.introScript ?? "",
    };
  }

  private buildReport(topics: TopicsResponse): StructuredReport {
    const sections: ReportSection[] = [];

    sections.push({
      heading: "Theme",
      content: topics.theme,
    });

    const promptLines = topics.prompts.map((p, i) =>
      `${i + 1}. ${p.topic}\n   ${p.context} (${p.suggestedTimeMinutes} min)`,
    );
    sections.push({
      heading: "Topics",
      content: promptLines.join("\n\n"),
    });

    return {
      title: "Table Topics",
      sections,
      data: { theme: topics.theme, promptCount: topics.prompts.length },
    };
  }

  private buildFallbackReport(theme: string | null): StructuredReport {
    return {
      title: "Table Topics",
      sections: [{
        heading: "Status",
        content: "Topic generation unavailable — the language model could not be reached.",
      }],
      data: { error: true, ...(theme ? { theme } : {}) },
    };
  }
}
