// AI Speech Evaluator - Entry point
// Wires up all pipeline dependencies and starts the server.

import "dotenv/config";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import OpenAI from "openai";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { createAppServer } from "./server.js";
import { SessionManager } from "./session-manager.js";
import { TranscriptionEngine } from "./transcription-engine.js";
import type { OpenAITranscriptionClient } from "./transcription-engine.js";
import { MetricsExtractor } from "./metrics-extractor.js";
import { EvaluationGenerator } from "./evaluation-generator.js";
import type { OpenAIClient } from "./evaluation-generator.js";
import { TTSEngine } from "./tts-engine.js";
import type { OpenAITTSClient } from "./tts-engine.js";
import { FilePersistence } from "./file-persistence.js";
import { VADMonitor } from "./vad-monitor.js";
import type { VADConfig, VADEventCallback } from "./vad-monitor.js";
import { VideoProcessor } from "./video-processor.js";
import type { VideoProcessorDeps } from "./video-processor.js";
import type { VideoConfig } from "./types.js";
import { createUploadRouter } from "./upload-handler.js";
import { StubPoseDetector } from "./stub-pose-detector.js";
import { StubFaceDetector } from "./stub-face-detector.js";
import { TfjsFaceDetector } from "./tfjs-face-detector.js";
import { TfjsPoseDetector } from "./tfjs-pose-detector.js";
import { initTfjsWasm } from "./tfjs-setup.js";
import type { FaceDetector, PoseDetector } from "./video-processor.js";
import { createAuthMiddleware, verifyAndAuthorize } from "./auth-middleware.js";
import { parse as parseCookie } from "cookie";

export { APP_NAME, APP_VERSION } from "./version.js";
import { APP_NAME, APP_VERSION } from "./version.js";

const ts = () => new Date().toISOString();
const logInit = (msg: string) => console.log(`[INIT] [${ts()}] ${msg}`);
const logFatal = (msg: string) => console.error(`[FATAL] [${ts()}] ${msg}`);

const port = parseInt(process.env.PORT || "3000", 10);

// ─── Validate API keys ─────────────────────────────────────────────────────────

const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
const openaiKey = process.env.OPENAI_API_KEY?.trim();

if (!deepgramKey) {
  logFatal("DEEPGRAM_API_KEY is not set. Add it to your .env file.");
  process.exit(1);
}

if (!openaiKey) {
  logFatal("OPENAI_API_KEY is not set. Add it to your .env file.");
  process.exit(1);
}

logInit("API keys loaded");

// ─── Prevent uncaught exceptions from crashing the server ──────────────────────
process.on("uncaughtException", (err) => {
  console.error(`[FATAL] [${ts()}] Uncaught exception:`, err);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[FATAL] [${ts()}] Unhandled rejection:`, reason);
});

// ─── Initialize API clients ─────────────────────────────────────────────────────

logInit("Creating Deepgram client...");
const deepgramClient = createDeepgramClient(deepgramKey);

logInit("Creating OpenAI client...");
const openaiClient = new OpenAI({ apiKey: openaiKey });

// ─── Initialize pipeline components ─────────────────────────────────────────────

logInit("Initializing TranscriptionEngine (Deepgram live + OpenAI post-speech)...");
const transcriptionEngine = new TranscriptionEngine(deepgramClient, openaiClient as unknown as OpenAITranscriptionClient);

logInit("Initializing MetricsExtractor...");
const metricsExtractor = new MetricsExtractor();

logInit("Initializing EvaluationGenerator (GPT-4o)...");
const evaluationGenerator = new EvaluationGenerator(openaiClient as unknown as OpenAIClient);

logInit("Initializing TTSEngine (OpenAI TTS)...");
const ttsEngine = new TTSEngine(openaiClient as unknown as OpenAITTSClient);

logInit("Initializing FilePersistence (output/)...");
const filePersistence = new FilePersistence("output");

// ─── Initialize ML detectors (with graceful fallback to stubs) ──────────────────

let faceDetector: FaceDetector;
let poseDetector: PoseDetector;

try {
  logInit("Initializing TF.js WASM backend...");
  await initTfjsWasm();
  logInit("TF.js WASM backend ready");

  logInit("Loading BlazeFace (face detection)...");
  const tfjsFace = new TfjsFaceDetector();
  await tfjsFace.init();
  faceDetector = tfjsFace;
  logInit("BlazeFace loaded ✓");

  logInit("Loading MoveNet Lightning (pose estimation)...");
  const tfjsPose = new TfjsPoseDetector();
  await tfjsPose.init();
  poseDetector = tfjsPose;
  logInit("MoveNet Lightning loaded ✓");
} catch (err) {
  logInit(`ML detector init failed, using stubs: ${err}`);
  faceDetector = new StubFaceDetector();
  poseDetector = new StubPoseDetector();
}

// ─── Create SessionManager with all dependencies ────────────────────────────────

logInit("Wiring SessionManager pipeline...");
const sessionManager = new SessionManager({
  transcriptionEngine,
  metricsExtractor,
  evaluationGenerator,
  ttsEngine,
  filePersistence,
  vadMonitorFactory: (config: VADConfig, callbacks: VADEventCallback) =>
    new VADMonitor(config, callbacks),
  videoProcessorFactory: (config: VideoConfig, deps: VideoProcessorDeps) =>
    new VideoProcessor(config, {
      poseDetector: deps.poseDetector ?? poseDetector,
      faceDetector: deps.faceDetector ?? faceDetector,
    }),
});

// ─── Upload Router ──────────────────────────────────────────────────────────────

logInit("Initializing upload endpoint...");
const uploadRouter = createUploadRouter({
  transcriptionEngine,
  metricsExtractor,
  evaluationGenerator,
  ttsEngine,
});

// ─── Firebase Auth & Authorization ──────────────────────────────────────────────

const allowedEmailsRaw = process.env.ALLOWED_EMAILS || "";
const allowedEmails = new Set(
  allowedEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

let authMiddleware;
let wsAuthVerify;

if (allowedEmails.size > 0) {
  logInit(`Auth enabled: ${allowedEmails.size} allowed email(s)`);
  const firebaseApp = initializeApp({
    credential: applicationDefault(),
  });

  authMiddleware = createAuthMiddleware({ firebaseApp, allowedEmails });

  wsAuthVerify = async (req: import("node:http").IncomingMessage) => {
    const cookieHeader = req.headers.cookie || "";
    const cookies = parseCookie(cookieHeader);
    const token = cookies.__session;
    if (!token) return false;
    const decoded = await verifyAndAuthorize(token, firebaseApp, allowedEmails);
    return decoded !== null;
  };
} else {
  logInit("Auth disabled: ALLOWED_EMAILS not set (dev mode)");
}

// ─── Start server ───────────────────────────────────────────────────────────────

const server = createAppServer({ sessionManager, uploadRouter, version: APP_VERSION, authMiddleware, wsAuthVerify });

server.listen(port).then(() => {
  logInit(`${APP_NAME} v${APP_VERSION} running at http://localhost:${port}`);
  logInit("Pipeline: Deepgram → OpenAI Transcribe → MetricsExtractor → GPT-4o → TTS");
  logInit("Ready for connections");
});
