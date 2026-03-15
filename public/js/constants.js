/**
 * Frontend Constants — shared constants for the speech evaluator UI.
 * Extracted from index.html for ES module pattern (#80).
 */

// ─── Session State Constants ──────────────────────────────────────────
export const SessionState = Object.freeze({
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  DELIVERING: "delivering",
});

// ─── Status Text Map ──────────────────────────────────────────────────
export const STATUS_TEXT = {
  [SessionState.IDLE]: 'Ready — click "Start Speech" to begin',
  [SessionState.RECORDING]: "Recording speech...",
  [SessionState.PROCESSING]: 'Speech processed — click "Deliver Evaluation" when ready',
  [SessionState.DELIVERING]: "Delivering evaluation...",
};

// ─── Upload Config ────────────────────────────────────────────────────
export const MAX_UPLOAD_SIZE_MB = 2048; // GCS signed URL upload bypasses Cloud Run 32 MiB limit

// ─── Pathways Project Types ───────────────────────────────────────────
export const PROJECT_TYPES = {
  "Ice Breaker": [
    "Introduce yourself and share your personal story",
    "Organize your speech with an opening, body, and conclusion",
    "Speak for 4-6 minutes",
  ],
  "Evaluation and Feedback": [
    "Present a speech on any topic",
    "Receive and apply feedback from evaluators",
    "Speak for 5-7 minutes",
  ],
  "Researching and Presenting": [
    "Research a topic and present your findings",
    "Use credible sources to support your points",
    "Speak for 5-7 minutes",
  ],
  "Introduction to Vocal Variety": [
    "Use vocal variety to enhance your message",
    "Vary pace, pitch, volume, and pauses",
    "Speak for 5-7 minutes",
  ],
  "Connect with Storytelling": [
    "Share a personal story that connects with the audience",
    "Use vivid language and emotional appeal",
    "Speak for 5-7 minutes",
  ],
  "Persuasive Speaking": [
    "Persuade the audience to adopt your viewpoint",
    "Use logical arguments and emotional appeals",
    "Speak for 5-7 minutes",
  ],
  "Custom / Other": [],
};

// ─── Cooldown Config ──────────────────────────────────────────────────
export const COOLDOWN_MS = 2500;
