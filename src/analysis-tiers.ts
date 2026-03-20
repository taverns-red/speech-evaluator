// Analysis tiers — configurable depth for speech evaluation (#125)
//
// Standard: text-only (current behavior)
// Enhanced+: GPT-4o Vision on extracted video frames

export enum AnalysisTier {
  Standard = "standard",
  Enhanced = "enhanced",
  Detailed = "detailed",
  Maximum = "maximum",
}

export interface TierConfig {
  vision: boolean;
  samplingIntervalSeconds: number; // 0 = no vision
  detail: "low" | "high";
  maxFrames: number; // 0 = no vision
}

// Pricing constants (USD, March 2026)
const DEEPGRAM_PER_MINUTE = 0.0043;
const GPT4O_INPUT_PER_1M_TOKENS = 2.50;
const GPT4O_OUTPUT_PER_1M_TOKENS = 10.00;
const TTS_PER_1M_CHARS = 15.00;
const CLOUD_RUN_PER_MINUTE = 0.003;

// Vision token estimates per frame
const TOKENS_PER_FRAME_LOW = 85;
const TOKENS_PER_FRAME_HIGH = 765;

// Text evaluation estimates (typical 7-min speech)
const AVG_INPUT_TOKENS = 2500;  // transcript + prompt
const AVG_OUTPUT_TOKENS = 1500; // evaluation
const AVG_TTS_CHARS = 2000;     // spoken evaluation

export const TIER_CONFIGS: Record<AnalysisTier, TierConfig> = {
  [AnalysisTier.Standard]: {
    vision: false,
    samplingIntervalSeconds: 0,
    detail: "low",
    maxFrames: 0,
  },
  [AnalysisTier.Enhanced]: {
    vision: true,
    samplingIntervalSeconds: 10,
    detail: "low",
    maxFrames: 120, // 20 min at 1/10s
  },
  [AnalysisTier.Detailed]: {
    vision: true,
    samplingIntervalSeconds: 5,
    detail: "high",
    maxFrames: 360, // 30 min at 1/5s
  },
  [AnalysisTier.Maximum]: {
    vision: true,
    samplingIntervalSeconds: 1,
    detail: "high",
    maxFrames: 600, // 10 min at 1fps
  },
};

export function getTierConfig(tier: AnalysisTier): TierConfig {
  return TIER_CONFIGS[tier];
}

export function estimateCost(tier: AnalysisTier, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;

  const config = getTierConfig(tier);
  const durationMinutes = durationSeconds / 60;

  // Base costs (always incurred)
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
