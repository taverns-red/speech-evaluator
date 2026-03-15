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
import { GCSUploadService, createGCSClient } from "./gcs-upload.js";
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
let gcsUploadService: GCSUploadService | undefined;
try {
  gcsUploadService = new GCSUploadService(createGCSClient());
  logInit("GCS upload service initialized (two-phase upload enabled)");
} catch (err) {
  logInit(`GCS upload service unavailable, using legacy direct upload only: ${err}`);
}
const uploadRouter = createUploadRouter({
  transcriptionEngine,
  metricsExtractor,
  evaluationGenerator,
  ttsEngine,
  gcsUploadService,
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

// ─── Firebase client config (served at /api/config for login page) ───────────
const firebaseApiKey = process.env.FIREBASE_API_KEY?.trim();
const firebaseConfig = firebaseApiKey
  ? {
    apiKey: firebaseApiKey,
    authDomain: "toast-stats-prod-6d64a.firebaseapp.com",
    projectId: "toast-stats-prod-6d64a",
    appId: "1:736334703361:web:b7174dfd26dab25cf2c900",
    messagingSenderId: "736334703361",
    measurementId: "G-LLLNH352T3",
  }
  : undefined;

if (!firebaseConfig) {
  logInit("WARNING: FIREBASE_API_KEY not set — /api/config will not be available");
}

// ─── Start server ───────────────────────────────────────────────────────────────

// ─── Meeting Roles (Phase 9, #72) ───────────────────────────────────────────────
import { RoleRegistry } from "./role-registry.js";
import { AhCounterRole } from "./roles/ah-counter-role.js";

const roleRegistry = new RoleRegistry();
roleRegistry.register(new AhCounterRole());
console.log(`[Roles] Registered ${roleRegistry.size} role(s): ${roleRegistry.list().map((r) => r.name).join(", ")}`);

const server = createAppServer({ sessionManager, uploadRouter, version: APP_VERSION, authMiddleware, wsAuthVerify, firebaseConfig, roleRegistry });

server.listen(port).then(() => {
  logInit(`${APP_NAME} v${APP_VERSION} running at http://localhost:${port}`);
  logInit("Pipeline: Deepgram → OpenAI Transcribe → MetricsExtractor → GPT-4o → TTS");
  logInit("Ready for connections");
});
