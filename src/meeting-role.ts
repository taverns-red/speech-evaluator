/**
 * MeetingRole — pluggable meeting role abstraction.
 *
 * Each role is a plugin that receives shared session data (transcript,
 * metrics, visual observations) and produces a structured report with
 * an optional spoken script for TTS delivery.
 *
 * This is the foundation for the Meeting Roles Platform (Phase 9, #72).
 * Roles are registered at startup via `RoleRegistry` and selected by
 * the operator per session.
 *
 * Issue: #72
 */

import type {
  TranscriptSegment,
  DeliveryMetrics,
  ConsentRecord,
  ProjectContext,
  VisualObservations,
} from "./types.js";

// ─── Role Input Requirements ────────────────────────────────────────────────────

/**
 * Data sources a role can depend on. Used by RoleRegistry to determine
 * which roles are runnable given the available session data.
 */
export type RoleInput =
  | "transcript"
  | "metrics"
  | "visualObservations";

// ─── Role Context ───────────────────────────────────────────────────────────────

/**
 * Shared session data passed to every active role.
 * All fields are readonly — roles must not mutate session state.
 */
export interface RoleContext {
  readonly transcript: TranscriptSegment[];
  readonly metrics: DeliveryMetrics | null;
  readonly visualObservations: VisualObservations | null;
  readonly projectContext: ProjectContext | null;
  readonly consent: ConsentRecord | null;
  readonly speakerName: string | null;
  /** Role-specific configuration (e.g., wordOfTheDay for Ah-Counter). */
  readonly config: Record<string, unknown>;
}

// ─── Role Result ────────────────────────────────────────────────────────────────

/**
 * Structured report output from a role.
 * The `sections` array enables flexible rendering in the UI.
 */
export interface ReportSection {
  heading: string;
  content: string;
}

export interface StructuredReport {
  title: string;
  sections: ReportSection[];
  /** Optional raw data for programmatic access (e.g., filler word counts). */
  data?: Record<string, unknown>;
}

/**
 * Output from a role's `run()` method.
 */
export interface RoleResult {
  roleId: string;
  report: StructuredReport;
  /** Rendered spoken text suitable for TTS synthesis. */
  script: string;
  /** Pre-synthesized TTS audio, if the role handles its own TTS. */
  ttsAudio?: Buffer;
}

// ─── Meeting Role Interface ─────────────────────────────────────────────────────

/**
 * The core interface for all meeting roles.
 *
 * Roles are stateless — they receive all needed data via `RoleContext`
 * and return a `RoleResult`. No side effects, no session mutation.
 *
 * Example roles: Speech Evaluator, Ah-Counter, Grammarian, Timer.
 */
export interface MeetingRole {
  /** Unique identifier, e.g. "speech-evaluator", "ah-counter". */
  readonly id: string;
  /** Human-readable display name, e.g. "Speech Evaluator". */
  readonly name: string;
  /** Short description shown in role selector UI. */
  readonly description: string;
  /**
   * Which data sources this role requires. The RoleRegistry uses this
   * to filter out roles that can't run with the current session data.
   */
  readonly requiredInputs: readonly RoleInput[];
  /**
   * Execute the role against the shared session data.
   *
   * @param context - Readonly session data
   * @returns Structured report + spoken script
   * @throws Error if the role cannot produce a result (e.g., insufficient data)
   */
  run(context: RoleContext): Promise<RoleResult>;
}
