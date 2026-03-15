/**
 * Frontend utility functions — extracted from index.html for testability.
 *
 * These pure functions are used by the upload progress UI.
 * They are defined here as standalone modules and re-exported
 * for use in index.html via import and in tests via vitest.
 */

// ─── Speed & ETA Calculation ────────────────────────────────────────────────────

export interface ProgressSample {
  time: number;
  loaded: number;
}

export interface SpeedETA {
  speed: string | null;
  eta: string | null;
}

/**
 * Compute transfer speed and estimated time remaining from progress samples.
 *
 * Uses a sliding window (default 5 samples) for smoothing.
 *
 * @param samples - Array of {time, loaded} samples, mutated in place
 * @param loaded - Current bytes loaded
 * @param total - Total bytes
 * @param maxSamples - Maximum number of samples to keep (default 5)
 * @returns Speed string (MB/s) and ETA string, or null for each if insufficient data
 */
export function computeSpeedAndETA(
  samples: ProgressSample[],
  loaded: number,
  total: number,
  maxSamples = 5,
): SpeedETA {
  const now = Date.now();
  samples.push({ time: now, loaded });
  while (samples.length > maxSamples) samples.shift();

  if (samples.length < 2) return { speed: "Calculating...", eta: null };

  const first = samples[0];
  const last = samples[samples.length - 1];
  const dtSec = (last.time - first.time) / 1000;

  if (dtSec < 0.2) return { speed: "Calculating...", eta: null };

  const bytesPerSec = (last.loaded - first.loaded) / dtSec;

  const speed =
    bytesPerSec > 0
      ? (bytesPerSec / 1024 / 1024).toFixed(1) + " MB/s"
      : null;

  const remaining = total - loaded;
  const etaSec = bytesPerSec > 0 ? Math.ceil(remaining / bytesPerSec) : null;

  let eta: string | null = null;
  if (etaSec !== null) {
    if (etaSec > 60) eta = `~${Math.ceil(etaSec / 60)} min remaining`;
    else eta = `~${etaSec}s remaining`;
  }

  return { speed, eta };
}

// ─── Pipeline Step Logic ────────────────────────────────────────────────────────

/** Ordered pipeline step identifiers. */
export const PIPELINE_ORDER = [
  "Uploading",
  "Extracting",
  "Transcribing",
  "Evaluating",
  "Complete",
] as const;

/** Map from `updateUploadProgress` stage names to pipeline step identifiers. */
export const PIPELINE_STAGE_MAP: Record<string, string> = {
  Initializing: "Uploading",
  Uploading: "Uploading",
  Retrying: "Uploading",
  Processing: "Extracting",
  Extracting: "Extracting",
  Transcribing: "Transcribing",
  Evaluating: "Evaluating",
  Analyzing: "Evaluating",
  Complete: "Complete",
};

export type StepState = "inactive" | "active" | "completed";

/**
 * Given a stage name, compute the state for each pipeline step.
 *
 * @param stage - The current updateUploadProgress stage name
 * @returns Array of { step, state } for each pipeline step
 */
export function computePipelineStates(
  stage: string,
): Array<{ step: string; state: StepState }> {
  const activeStep = PIPELINE_STAGE_MAP[stage] ?? null;
  const activeIdx = activeStep ? PIPELINE_ORDER.indexOf(activeStep as typeof PIPELINE_ORDER[number]) : -1;

  return PIPELINE_ORDER.map((step, i) => ({
    step,
    state: i === activeIdx ? "active" : i < activeIdx ? "completed" : "inactive",
  }));
}

// ─── Elapsed Time Formatting ────────────────────────────────────────────────────

/**
 * Format elapsed seconds into a human-readable string.
 *
 * @param seconds - Number of seconds elapsed
 * @returns Formatted string like "5s" or "2m 30s"
 */
export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
