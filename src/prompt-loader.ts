/**
 * Prompt Loader — reads and caches LLM prompt templates from disk.
 *
 * Templates are stored as plain-text files in src/prompts/ (or dist/prompts/
 * after compilation). This module loads them once at startup and provides
 * a simple API for the EvaluationGenerator to assemble prompts.
 *
 * Issue: #82
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Template Cache ─────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Directory where prompt templates are stored */
const PROMPTS_DIR = join(__dirname, "prompts");

/** Cached template contents, keyed by filename */
const cache = new Map<string, string>();

/**
 * Loads a prompt template from the prompts directory.
 * Results are cached — each file is read from disk at most once.
 *
 * @param name - Filename (e.g., "system-base.txt")
 * @returns The template content as a string
 * @throws If the file cannot be read
 */
function loadTemplate(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const filePath = join(PROMPTS_DIR, name);
  const content = readFileSync(filePath, "utf-8");
  cache.set(name, content);
  return content;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * All prompt template identifiers.
 */
export const PromptTemplates = {
  SYSTEM_BASE: "system-base.txt",
  SYSTEM_QUALITY_WARNING: "system-quality-warning.txt",
  SYSTEM_FORM: "system-form.txt",
  SYSTEM_VISUAL: "system-visual.txt",
  SYSTEM_ITEM_RETRY: "system-item-retry.txt",
  // Style-specific addenda (#133)
  STYLE_SBI: "style-sbi.txt",
  STYLE_FEEDFORWARD: "style-feedforward.txt",
  STYLE_COIN: "style-coin.txt",
  STYLE_HOLISTIC: "style-holistic.txt",
} as const;

/** Maps EvaluationStyle enum values to their template files */
const STYLE_TEMPLATE_MAP: Record<string, string | undefined> = {
  classic: undefined, // uses default items schema from system-base.txt
  sbi: PromptTemplates.STYLE_SBI,
  feedforward: PromptTemplates.STYLE_FEEDFORWARD,
  coin: PromptTemplates.STYLE_COIN,
  holistic: PromptTemplates.STYLE_HOLISTIC,
};

/**
 * Builds the system prompt by composing the base template with
 * optional conditional addenda.
 *
 * @param options - Which addenda to include
 * @returns The complete system prompt string
 */
export function buildSystemPromptFromTemplates(options: {
  qualityWarning?: boolean;
  hasForm?: boolean;
  hasVisual?: boolean;
  evaluationStyle?: string;
}): string {
  let prompt = loadTemplate(PromptTemplates.SYSTEM_BASE);

  if (options.qualityWarning) {
    prompt += loadTemplate(PromptTemplates.SYSTEM_QUALITY_WARNING);
  }

  if (options.hasForm) {
    prompt += loadTemplate(PromptTemplates.SYSTEM_FORM);
  }

  if (options.hasVisual) {
    prompt += loadTemplate(PromptTemplates.SYSTEM_VISUAL);
  }

  // Append style-specific addendum for non-classic styles (#133)
  const styleTemplate = options.evaluationStyle ? STYLE_TEMPLATE_MAP[options.evaluationStyle] : undefined;
  if (styleTemplate) {
    prompt += loadTemplate(styleTemplate);
  }

  return prompt;
}

/**
 * Builds the item retry system prompt from the template,
 * substituting the item type placeholder.
 *
 * @param itemType - "commendation" or "recommendation"
 * @returns The complete system prompt for the retry request
 */
export function buildItemRetrySystemPrompt(itemType: string): string {
  const template = loadTemplate(PromptTemplates.SYSTEM_ITEM_RETRY);
  return template.replace("{{itemType}}", itemType);
}

/**
 * Clears the template cache. Useful for testing.
 */
export function clearPromptCache(): void {
  cache.clear();
}
