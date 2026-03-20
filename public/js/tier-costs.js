/**
 * Analysis tier cost estimation — frontend helper (#125)
 *
 * Mirrors the backend estimateCost() logic from analysis-tiers.ts
 * to show estimated costs in the tier selector UI without a server round-trip.
 */

// Tier configs (must match src/analysis-tiers.ts)
const TIER_CONFIGS = {
  standard: { vision: false, samplingIntervalSeconds: 0, detail: "low", maxFrames: 0 },
  enhanced: { vision: true, samplingIntervalSeconds: 10, detail: "low", maxFrames: 120 },
  detailed: { vision: true, samplingIntervalSeconds: 5, detail: "high", maxFrames: 360 },
  maximum:  { vision: true, samplingIntervalSeconds: 1, detail: "high", maxFrames: 600 },
};

// Pricing constants (USD, March 2026 — must match backend)
const DEEPGRAM_PER_MINUTE = 0.0043;
const GPT4O_INPUT_PER_1M_TOKENS = 2.50;
const GPT4O_OUTPUT_PER_1M_TOKENS = 10.00;
const TTS_PER_1M_CHARS = 15.00;
const CLOUD_RUN_PER_MINUTE = 0.003;
const TOKENS_PER_FRAME_LOW = 85;
const TOKENS_PER_FRAME_HIGH = 765;
const AVG_INPUT_TOKENS = 2500;
const AVG_OUTPUT_TOKENS = 1500;
const AVG_TTS_CHARS = 2000;

/**
 * Estimate cost for a given tier and speech duration.
 * @param {string} tier - "standard" | "enhanced" | "detailed" | "maximum"
 * @param {number} durationSeconds - Speech duration in seconds (default: 420 = 7 min)
 * @returns {number} Estimated cost in USD
 */
export function estimateCostFrontend(tier, durationSeconds = 420) {
  if (durationSeconds <= 0) return 0;

  const config = TIER_CONFIGS[tier] || TIER_CONFIGS.standard;
  const durationMinutes = durationSeconds / 60;

  const transcriptionCost = durationMinutes * DEEPGRAM_PER_MINUTE;
  const textInputCost = (AVG_INPUT_TOKENS / 1_000_000) * GPT4O_INPUT_PER_1M_TOKENS;
  const textOutputCost = (AVG_OUTPUT_TOKENS / 1_000_000) * GPT4O_OUTPUT_PER_1M_TOKENS;
  const ttsCost = (AVG_TTS_CHARS / 1_000_000) * TTS_PER_1M_CHARS;
  const computeCost = durationMinutes * CLOUD_RUN_PER_MINUTE;

  let visionCost = 0;
  if (config.vision && config.samplingIntervalSeconds > 0) {
    const rawFrames = Math.ceil(durationSeconds / config.samplingIntervalSeconds);
    const frames = Math.min(rawFrames, config.maxFrames);
    const tokensPerFrame = config.detail === "high" ? TOKENS_PER_FRAME_HIGH : TOKENS_PER_FRAME_LOW;
    const totalFrameTokens = frames * tokensPerFrame;
    visionCost = (totalFrameTokens / 1_000_000) * GPT4O_INPUT_PER_1M_TOKENS;
  }

  return transcriptionCost + textInputCost + textOutputCost + ttsCost + computeCost + visionCost;
}

/**
 * Format a cost as a human-readable string.
 * @param {number} cost - Cost in USD
 * @returns {string} Formatted cost string (e.g., "~$0.05", "< $0.01")
 */
export function formatCost(cost) {
  if (cost < 0.01) return "< $0.01";
  if (cost < 0.10) return `~$${cost.toFixed(2)}`;
  return `~$${cost.toFixed(2)}`;
}

/**
 * Update all tier cost labels in the UI.
 * @param {number} durationSeconds - Speech duration estimate (default: 420 = 7 min)
 */
export function updateTierCostLabels(durationSeconds = 420) {
  const tiers = ["standard", "enhanced", "detailed", "maximum"];
  for (const tier of tiers) {
    const el = document.querySelector(`.tier-cost[data-tier="${tier}"]`);
    if (el) {
      const cost = estimateCostFrontend(tier, durationSeconds);
      el.textContent = formatCost(cost);
    }
  }
}
