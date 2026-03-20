/**
 * Shared Evaluation Pipeline — single source of truth for the
 * transcription → metrics → evaluation → TTS pipeline.
 *
 * This module extracts the common pipeline logic that was previously
 * duplicated across three paths:
 *   1. SessionManager.generateEvaluation()   (live delivery path)
 *   2. SessionManager.runEagerPipeline()      (eager background path)
 *   3. upload-handler.ts runEvaluationPipeline (upload path)
 *
 * Issue: #79
 */

import type { EvaluationGenerator } from "./evaluation-generator.js";
import type { MetricsExtractor } from "./metrics-extractor.js";
import type { TTSEngine } from "./tts-engine.js";
import type { ToneChecker } from "./tone-checker.js";
import type {
  TranscriptSegment,
  DeliveryMetrics,
  StructuredEvaluation,
  StructuredEvaluationPublic,
  EvaluationConfig,
  ConsentRecord,
  VisualObservations,
} from "./types.js";

// ─── Pipeline Dependencies ───────────────────────────────────────────────────

/**
 * Dependencies for the shared evaluation pipeline.
 * All are optional except evaluationGenerator which is required.
 */
export interface EvaluationPipelineDeps {
  evaluationGenerator: EvaluationGenerator;
  metricsExtractor?: MetricsExtractor;
  ttsEngine?: TTSEngine;
  toneChecker?: ToneChecker;
}

// ─── Pipeline Input ──────────────────────────────────────────────────────────

/**
 * Input to the shared pipeline. Provides all data needed to generate
 * an evaluation, render a script, and synthesize TTS audio.
 */
export interface EvaluationPipelineInput {
  /** Final transcript segments */
  transcript: TranscriptSegment[];
  /** Extracted delivery metrics */
  metrics: DeliveryMetrics;
  /** Optional evaluation config (project context, objectives, form text) */
  evalConfig?: EvaluationConfig;
  /** Optional visual observations from video processing */
  visualObservations?: VisualObservations | null;
  /** Optional raw audio chunks for energy profile computation */
  audioChunks?: Buffer[];
  /** Optional consent record for name redaction */
  consent?: ConsentRecord | null;
  /** Time limit for TTS trimming (seconds) */
  timeLimitSeconds?: number;
  /** Whether the session has a quality warning */
  qualityWarning?: boolean;
  /** Whether video data is present (for scope acknowledgment) */
  hasVideo?: boolean;
  /**
   * Cancellation check — called at each async boundary.
   * If it returns true, the pipeline aborts and returns undefined.
   */
  isCancelled?: () => boolean;
  /**
   * Optional logging function.
   */
  log?: (level: "INFO" | "WARN" | "ERROR", msg: string) => void;
  /**
   * Optional callback invoked just before TTS synthesis begins (stage 8).
   * Used by the eager pipeline to emit progress events.
   */
  onBeforeTTS?: () => void;
}

// ─── Pipeline Result ─────────────────────────────────────────────────────────

export interface EvaluationPipelineResult {
  /** Internal (unredacted) evaluation */
  evaluation: StructuredEvaluation;
  /** Pass rate from evidence validation */
  passRate: number;
  /** Rendered evaluation script (unredacted, for internal use) */
  script: string;
  /** Redacted script for TTS (or unredacted if no consent/redaction) */
  scriptForTTS: string;
  /** Public (redacted) evaluation for UI/save, if redaction was applied */
  evaluationPublic: StructuredEvaluationPublic | null;
  /** Synthesized TTS audio, if TTS engine is available */
  ttsAudio?: Buffer;
}

// ─── Shared Pipeline ─────────────────────────────────────────────────────────

/**
 * Runs the shared evaluation pipeline (stages 1-8).
 *
 * Stages:
 *   1. LLM Generation (evidence validation + retry + shape check)
 *   2. Energy profile computation (optional, from audio chunks)
 *   3. Script rendering (with [[Q:*]] / [[M:*]] markers)
 *   4. Tone check + fix (strip violations, then strip markers)
 *   5. Timing trim (fit script to time limit)
 *   6. Scope acknowledgment (quality/structure warnings)
 *   7. Name redaction (produces redacted script + public evaluation)
 *   8. TTS synthesis
 *
 * Returns undefined if cancelled at any async boundary.
 */
export async function runEvaluationStages(
  input: EvaluationPipelineInput,
  deps: EvaluationPipelineDeps,
): Promise<EvaluationPipelineResult | undefined> {
  const { transcript, metrics, evalConfig, visualObservations, audioChunks, consent } = input;
  const log = input.log ?? (() => {});
  const isCancelled = input.isCancelled ?? (() => false);

  // ── Stage 1: LLM Generation ──
  log("INFO", `Generating evaluation (${transcript.length} segments, ${metrics.totalWords} words)`);
  const generateResult = await deps.evaluationGenerator.generate(
    transcript,
    metrics,
    evalConfig,
    visualObservations ?? null,
  );

  if (isCancelled()) return undefined;

  const evaluation = generateResult.evaluation;
  const passRate = generateResult.passRate;
  log("INFO", `Evaluation: ${evaluation.items.length} items, pass rate ${(passRate * 100).toFixed(0)}%`);

  // ── Stage 2: Energy profile + acoustic analysis (optional) ──
  if (deps.metricsExtractor && audioChunks && audioChunks.length > 0) {
    log("INFO", `Computing energy profile from ${audioChunks.length} audio chunks`);
    const energyProfile = deps.metricsExtractor.computeEnergyProfile(audioChunks);
    metrics.energyProfile = energyProfile;
    metrics.energyVariationCoefficient = energyProfile.coefficientOfVariation;

    // #124: Pitch profile (F0 contour)
    log("INFO", "Computing pitch profile (F0 extraction)");
    metrics.pitchProfile = deps.metricsExtractor.computePitchProfile(audioChunks);

    // #124: Prosodic indicators (jitter, onset strength) — needs transcript + audio
    if (transcript.length > 0) {
      log("INFO", "Computing prosodic indicators");
      metrics.prosodicIndicators = deps.metricsExtractor.computeProsodicIndicators(audioChunks, transcript);
    }
  }

  // #124: Pace variation (transcript-only, no audio needed)
  if (deps.metricsExtractor && transcript.length > 0) {
    log("INFO", "Computing pace variation");
    metrics.paceVariation = deps.metricsExtractor.computePaceVariation(transcript);
  }

  // ── Stage 3: Script rendering (with markers, UNREDACTED) ──
  log("INFO", "Rendering evaluation script");
  let script = deps.evaluationGenerator.renderScript(
    evaluation,
    undefined, // No speakerName — prevents old redaction path; redaction at stage 7
    metrics,
  );

  if (isCancelled()) return undefined;

  // ── Stage 4: Tone check + fix ──
  if (deps.toneChecker) {
    const hasVideo = input.hasVideo ?? false;
    const toneResult = deps.toneChecker.check(script, evaluation, metrics, { hasVideo });
    if (!toneResult.passed) {
      log("WARN", `Tone check found ${toneResult.violations.length} violation(s)`);
      script = deps.toneChecker.stripViolations(script, toneResult.violations);
    }
    // Strip markers exactly once at end of stage 4
    script = deps.toneChecker.stripMarkers(script);
  } else {
    // No ToneChecker — strip markers with regex fallback
    script = script.replace(/\s*\[\[(Q|M):[^\]]+\]\]/g, "").replace(/\s{2,}/g, " ").trim();
  }

  if (isCancelled()) return undefined;

  // ── Stage 5: Timing trim ──
  if (deps.ttsEngine && input.timeLimitSeconds) {
    log("INFO", `Trimming script to fit ${input.timeLimitSeconds}s time limit`);
    script = deps.ttsEngine.trimToFit(script, input.timeLimitSeconds);
  }

  // ── Stage 6: Scope acknowledgment ──
  if (deps.toneChecker) {
    const hasStructureCommentary = !!(
      evaluation.structure_commentary?.opening_comment ||
      evaluation.structure_commentary?.body_comment ||
      evaluation.structure_commentary?.closing_comment
    );
    const hasVideo = input.hasVideo ?? false;
    script = deps.toneChecker.appendScopeAcknowledgment(
      script,
      input.qualityWarning ?? false,
      hasStructureCommentary,
      { hasVideo },
    );
  }

  if (isCancelled()) return undefined;

  // Store unredacted script for internal use
  const unredactedScript = script;

  // ── Stage 7: Name redaction ──
  let scriptForTTS = script;
  let evaluationPublic: StructuredEvaluationPublic | null = null;

  if (consent && deps.evaluationGenerator) {
    log("INFO", "Applying name redaction");
    const redactionResult = deps.evaluationGenerator.redact({
      script,
      evaluation,
      consent,
    });
    scriptForTTS = redactionResult.scriptRedacted;
    evaluationPublic = redactionResult.evaluationPublic;
  }

  if (isCancelled()) return undefined;

  // ── Stage 8: TTS synthesis ──
  let ttsAudio: Buffer | undefined;
  if (deps.ttsEngine) {
    input.onBeforeTTS?.();
    log("INFO", `Synthesizing TTS audio (${scriptForTTS.split(/\s+/).length} words)`);
    ttsAudio = await deps.ttsEngine.synthesize(scriptForTTS);

    if (isCancelled()) return undefined;

    log("INFO", `TTS synthesis complete: ${ttsAudio.length} bytes`);
  }

  return {
    evaluation,
    passRate,
    script: unredactedScript,
    scriptForTTS,
    evaluationPublic,
    ttsAudio,
  };
}
