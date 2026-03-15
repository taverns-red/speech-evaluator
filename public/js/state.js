/**
 * Shared application state — single source of truth for all modules.
 *
 * Every module imports state from here. State is mutated directly
 * (this is a vanilla JS app, not a framework). The dom cache is
 * populated by main.js after DOMContentLoaded.
 */
import { SessionState } from "./constants.js";

// ─── Application State ────────────────────────────────────────────
export let currentState = SessionState.IDLE;
export let hasEvaluationData = false;
export let hasTTSAudio = false;
export let outputsSaved = false;
export let segments = []; // local transcript segment array

// ─── Phase 2: Consent & Time Limit State ─────────────────────────
export let consentConfirmed = false;
export let consentSpeakerName = "";
export let dataPurged = false;
export let estimatedDuration = null;
export let configuredTimeLimit = 120;

// ─── Eager Pipeline State ─────────────────────────────────────────
/** Current pipeline stage for UI display and button gating */
export let pipelineStage = "idle";
/** RunId for stale-progress filtering; 0 = accept all */
export let pipelineRunId = 0;

// ─── Phase 3: VAD Configuration State ─────────────────────────────
export let vadEnabled = true;
export let vadSilenceThreshold = 5;
export let vadNotificationVisible = false;

// ─── Phase 3: Project Context State ──────────────────────────────
export let projectContext = { speechTitle: "", projectType: "", objectives: [] };

// ─── Phase 4: Video Consent State ────────────────────────────────
export let videoConsentEnabled = false;
export let videoStreamReady = false;
export let videoFpsConfig = 2;

// ─── Phase 3: VAD Audio Level Meter State ────────────────────────
export let lastVadStatusTime = 0;
export let useVadEnergy = false;

// ─── TTS Audio Playback State ────────────────────────────────────
export let ttsAudioElement = null;
export let ttsBlobUrl = null;
export let ttsPlaying = false;
export let ttsDeliveryComplete = false;
export let lastEvaluationScript = "";
export let lastEvaluationData = null;
export let highlightDismissTimer = null;
export let playbackInstanceToken = 0;
export let deferredIdleTransition = null;
export let pendingIdleFromServer = null;

// ─── Audio Capture State ──────────────────────────────────────────
export let ws = null;
export let audioContext = null;
export let workletNode = null;
export let mediaStream = null;
export let sourceNode = null;
export let audioFormatSent = false;

// ─── Speech Recording State ──────────────────────────────────────
export let speechRecorder = null;
export let speechRecordingChunks = [];
export let speechRecordingBlob = null;
export let inCooldown = false;
export let cooldownTimer = null;

// ─── Meeting Roles ───────────────────────────────────────────────
export const activeRoles = new Set();

// ─── Upload State ────────────────────────────────────────────────
export let pendingFormFile = null;
export let uploadStartTime = null;
export let uploadElapsedInterval = null;
export const uploadProgressSamples = [];
export let activeUploadXHR = null;

// ─── Mode State ──────────────────────────────────────────────────
export let currentMode = "live";

// ─── Video Capture State ─────────────────────────────────────────
export let videoStream = null;
export let videoTrack = null;
export let facingMode = "user";
export let captureInterval = null;
export let captureCanvas = null;
export let captureCtx = null;
export let framePayloadHeader = null;
export let videoFrameCount = 0;
export let lastVideoStatsUpdate = 0;
export let videoQualityGrade = null;

// ─── DOM References ──────────────────────────────────────────────
// Populated by main.js after DOM is ready
export const dom = {};

/**
 * Set a state variable. Since ES module exports are live bindings but
 * cannot be reassigned from outside the declaring module, we provide
 * a setter. Modules call setState('key', value) instead of direct assignment.
 */
export function setState(key, value) {
  switch (key) {
    case "currentState": currentState = value; break;
    case "hasEvaluationData": hasEvaluationData = value; break;
    case "hasTTSAudio": hasTTSAudio = value; break;
    case "outputsSaved": outputsSaved = value; break;
    case "segments": segments = value; break;
    case "consentConfirmed": consentConfirmed = value; break;
    case "consentSpeakerName": consentSpeakerName = value; break;
    case "dataPurged": dataPurged = value; break;
    case "estimatedDuration": estimatedDuration = value; break;
    case "configuredTimeLimit": configuredTimeLimit = value; break;
    case "pipelineStage": pipelineStage = value; break;
    case "pipelineRunId": pipelineRunId = value; break;
    case "vadEnabled": vadEnabled = value; break;
    case "vadSilenceThreshold": vadSilenceThreshold = value; break;
    case "vadNotificationVisible": vadNotificationVisible = value; break;
    case "projectContext": projectContext = value; break;
    case "videoConsentEnabled": videoConsentEnabled = value; break;
    case "videoStreamReady": videoStreamReady = value; break;
    case "videoFpsConfig": videoFpsConfig = value; break;
    case "lastVadStatusTime": lastVadStatusTime = value; break;
    case "useVadEnergy": useVadEnergy = value; break;
    case "ttsAudioElement": ttsAudioElement = value; break;
    case "ttsBlobUrl": ttsBlobUrl = value; break;
    case "ttsPlaying": ttsPlaying = value; break;
    case "ttsDeliveryComplete": ttsDeliveryComplete = value; break;
    case "lastEvaluationScript": lastEvaluationScript = value; break;
    case "lastEvaluationData": lastEvaluationData = value; break;
    case "highlightDismissTimer": highlightDismissTimer = value; break;
    case "playbackInstanceToken": playbackInstanceToken = value; break;
    case "deferredIdleTransition": deferredIdleTransition = value; break;
    case "pendingIdleFromServer": pendingIdleFromServer = value; break;
    case "ws": ws = value; break;
    case "audioContext": audioContext = value; break;
    case "workletNode": workletNode = value; break;
    case "mediaStream": mediaStream = value; break;
    case "sourceNode": sourceNode = value; break;
    case "audioFormatSent": audioFormatSent = value; break;
    case "speechRecorder": speechRecorder = value; break;
    case "speechRecordingChunks": speechRecordingChunks = value; break;
    case "speechRecordingBlob": speechRecordingBlob = value; break;
    case "inCooldown": inCooldown = value; break;
    case "cooldownTimer": cooldownTimer = value; break;
    case "pendingFormFile": pendingFormFile = value; break;
    case "uploadStartTime": uploadStartTime = value; break;
    case "uploadElapsedInterval": uploadElapsedInterval = value; break;
    case "activeUploadXHR": activeUploadXHR = value; break;
    case "currentMode": currentMode = value; break;
    case "videoStream": videoStream = value; break;
    case "videoTrack": videoTrack = value; break;
    case "facingMode": facingMode = value; break;
    case "captureInterval": captureInterval = value; break;
    case "captureCanvas": captureCanvas = value; break;
    case "captureCtx": captureCtx = value; break;
    case "framePayloadHeader": framePayloadHeader = value; break;
    case "videoFrameCount": videoFrameCount = value; break;
    case "lastVideoStatsUpdate": lastVideoStatsUpdate = value; break;
    case "videoQualityGrade": videoQualityGrade = value; break;
    default: throw new Error(`Unknown state key: ${key}`);
  }
}

/**
 * Initialize the DOM cache. Called once by main.js after DOM is ready.
 */
export function initDom() {
  Object.assign(dom, {
    statusIndicator: document.getElementById("status-indicator"),
    statusText: document.getElementById("status-text"),
    elapsedTime: document.getElementById("elapsed-time"),
    btnStart: document.getElementById("btn-start"),
    btnStop: document.getElementById("btn-stop"),
    btnDeliver: document.getElementById("btn-deliver"),
    btnReplay: document.getElementById("btn-replay"),
    btnSave: document.getElementById("btn-save"),
    btnPdf: document.getElementById("btn-pdf"),
    btnPanic: document.getElementById("btn-panic"),
    btnRevoke: document.getElementById("btn-revoke"),
    btnUpload: document.getElementById("btn-upload"),
    speakingIndicator: document.getElementById("speaking-indicator"),
    processingIndicator: document.getElementById("processing-indicator"),
    transcriptPanel: document.getElementById("transcript-panel"),
    transcriptContent: document.getElementById("transcript-content"),
    transcriptWordCount: document.getElementById("transcript-word-count"),
    evaluationPanel: document.getElementById("evaluation-panel"),
    evaluationContent: document.getElementById("evaluation-content"),
    errorBanner: document.getElementById("error-banner"),
    errorMessage: document.getElementById("error-message"),
    interruptionBanner: document.getElementById("interruption-banner"),
    savedConfirmation: document.getElementById("saved-confirmation"),
    savedMessage: document.getElementById("saved-message"),
    connectionStatus: document.getElementById("connection-status"),
    audioLevel: document.getElementById("audio-level"),
    audioLevelBar: document.getElementById("audio-level-bar"),
    // Phase 2
    consentForm: document.getElementById("consent-form"),
    speakerNameInput: document.getElementById("speaker-name-input"),
    consentCheckbox: document.getElementById("consent-checkbox"),
    consentStatus: document.getElementById("consent-status"),
    timeLimitControl: document.getElementById("time-limit-control"),
    timeLimitInput: document.getElementById("time-limit-input"),
    durationEstimate: document.getElementById("duration-estimate"),
    durationEstimateText: document.getElementById("duration-estimate-text"),
    purgeBanner: document.getElementById("purge-banner"),
    purgeMessage: document.getElementById("purge-message"),
    // Phase 3: VAD
    vadConfig: document.getElementById("vad-config"),
    vadEnabledCheckbox: document.getElementById("vad-enabled-checkbox"),
    vadThresholdSlider: document.getElementById("vad-threshold-slider"),
    vadThresholdValue: document.getElementById("vad-threshold-value"),
    vadNotification: document.getElementById("vad-notification"),
    // Phase 3: Project Context
    projectContextForm: document.getElementById("project-context-form"),
    speechTitleInput: document.getElementById("speech-title-input"),
    projectTypeSelect: document.getElementById("project-type-select"),
    objectivesTextarea: document.getElementById("objectives-textarea"),
    // Phase 4: Video
    videoConsentCheckbox: document.getElementById("video-consent-checkbox"),
    videoConsentError: document.getElementById("video-consent-error"),
    videoFpsConfig: document.getElementById("video-fps-config"),
    videoFpsSlider: document.getElementById("video-fps-slider"),
    videoFpsValue: document.getElementById("video-fps-value"),
  });
}
