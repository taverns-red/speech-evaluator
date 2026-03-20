/**
 * Consent, VAD config, project context, and form persistence handlers.
 * Extracted from app.js for ES module pattern (#110).
 */
import { S, dom } from "./state.js";
import { SessionState, PROJECT_TYPES } from "./constants.js";
import { show, hide, enable, disable } from "./utils.js";
import {
  updateUI, updateConsentStatusDisplay, showNotification,
  dismissVADNotification, resetVadEnergyState, updateDurationEstimateDisplay,
} from "./ui.js";
import { wsSend, onStopSpeech } from "./websocket.js";
import { acquireCamera, releaseCamera } from "./video.js";

// ─── Consent Form Event Handlers ──────────────────────────────────


// ─── Form State Persistence (#58) ────────────────────────────────
const FORM_STORAGE_KEY = "speech-evaluator-form";

export function saveFormState() {
  try {
    const state = {
      speakerName: dom.speakerNameInput.value,
      consentConfirmed: dom.consentCheckbox.checked,
      speechTitle: dom.speechTitleInput.value,
      projectType: dom.projectTypeSelect.value,
      objectives: dom.objectivesTextarea.value,
      analysisTier: S.analysisTier,
    };
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

export function restoreFormState() {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.speakerName) dom.speakerNameInput.value = state.speakerName;
    if (state.consentConfirmed) dom.consentCheckbox.checked = true;
    if (state.speechTitle) dom.speechTitleInput.value = state.speechTitle;
    if (state.projectType) dom.projectTypeSelect.value = state.projectType;
    if (state.objectives) dom.objectivesTextarea.value = state.objectives;

    // Sync local state variables with restored values
    S.consentSpeakerName = (state.speakerName || "").trim();
    S.consentConfirmed = state.consentConfirmed && S.consentSpeakerName.length > 0;
    S.projectContext.speechTitle = (state.speechTitle || "").trim();
    S.projectContext.projectType = state.projectType || "";
    if (state.objectives) {
      S.projectContext.objectives = state.objectives.split("\n")
        .map(function (l) { return l.trim(); })
        .filter(function (l) { return l.length > 0; });
    }

    // Restore analysis tier
    if (state.analysisTier) {
      S.analysisTier = state.analysisTier;
      const radio = document.querySelector(`input[name="analysis-tier"][value="${state.analysisTier}"]`);
      if (radio) radio.checked = true;
    }

    // Enable video consent checkbox if audio consent is confirmed
    if (S.consentConfirmed) {
      enable(dom.videoConsentCheckbox);
    }
  } catch (e) {
    // Corrupted or missing — ignore
  }
}

export function clearFormState() {
  try {
    localStorage.removeItem(FORM_STORAGE_KEY);
  } catch (e) {
    // Ignore
  }
}

// ─── Consent Form Event Handlers (continued) ─────────────────────
/**
 * Called when the speaker name input or consent checkbox changes.
 * Sends set_consent message to server and updates local state.
 */
let consentDebounceTimer = null;

export function onConsentChange() {
  const name = dom.speakerNameInput.value.trim();
  const checked = dom.consentCheckbox.checked;

  S.consentSpeakerName = name;
  S.consentConfirmed = checked && name.length > 0;

  // Persist form state across page refreshes (#58)
  saveFormState();

  // Debounce consent messages to avoid per-keystroke chattiness (#31)
  clearTimeout(consentDebounceTimer);
  consentDebounceTimer = setTimeout(() => {
    wsSend({
      type: "set_consent",
      speakerName: name,
      consentConfirmed: checked && name.length > 0,
    });
  }, 350);

  // Enable/disable video consent checkbox based on audio consent (Req 1.1)
  if (S.consentConfirmed) {
    enable(dom.videoConsentCheckbox);
  } else {
    // If audio consent is revoked, also disable and uncheck video consent
    disable(dom.videoConsentCheckbox);
    if (S.videoConsentEnabled) {
      dom.videoConsentCheckbox.checked = false;
      S.videoConsentEnabled = false;
      S.videoStreamReady = false;
      releaseCamera();
      hideVideoConsentError();
    }
  }

  // Update Start Speech button gating
  updateUI(S.currentState);
}

/**
 * Called when the video consent checkbox changes.
 * Acquires camera on enable, releases on disable.
 * Sends set_video_consent and video_stream_ready messages. (Req 1.1, 1.2, 1.5)
 */
export async function onVideoConsentChange() {
  const checked = dom.videoConsentCheckbox.checked;
  hideVideoConsentError();

  if (checked) {
    // Attempt to acquire camera (Req 1.5)
    const acquired = await acquireCamera();
    if (acquired) {
      S.videoConsentEnabled = true;
      S.videoStreamReady = true;

      // Send video consent to server (Req 1.2)
      wsSend({
        type: "set_video_consent",
        consentGranted: true,
        timestamp: new Date().toISOString(),
      });

      // Send video_stream_ready to server (Req 1.5)
      const readyMsg = {
        type: "video_stream_ready",
        width: 0,
        height: 0,
      };
      // Include dimensions and device label if available (Req 10.2)
      if (S.videoStream) {
        const tracks = S.videoStream.getVideoTracks();
        if (tracks.length > 0) {
          const settings = tracks[0].getSettings();
          readyMsg.width = settings.width || 0;
          readyMsg.height = settings.height || 0;
          if (tracks[0].label) {
            readyMsg.deviceLabel = tracks[0].label;
          }
        }
      }
      wsSend(readyMsg);
    } else {
      // Camera acquisition failed — revert toggle (Req 1.5)
      dom.videoConsentCheckbox.checked = false;
      S.videoConsentEnabled = false;
      S.videoStreamReady = false;
      showVideoConsentError("Camera access denied or unavailable. Video consent requires camera permission.");
    }
  } else {
    // Video consent disabled — release camera
    S.videoConsentEnabled = false;
    S.videoStreamReady = false;
    releaseCamera();
  }

  // Update UI to show/hide video preview and FPS config
  updateUI(S.currentState);
}

/**
 * Shows a video consent error message below the checkbox.
 * @param {string} message - Error message to display
 */
export function showVideoConsentError(message) {
  dom.videoConsentError.textContent = message;
  dom.videoConsentError.classList.add("visible");
}

/**
 * Hides the video consent error message.
 */
export function hideVideoConsentError() {
  dom.videoConsentError.textContent = "";
  dom.videoConsentError.classList.remove("visible");
}

/**
 * Called when the video FPS slider changes.
 * Sends set_video_config message to server. (Req 2.9)
 */
export function onVideoFpsChange() {
  var fps = parseInt(dom.videoFpsSlider.value, 10);
  if (isNaN(fps) || fps < 1 || fps > 5) return;

  S.videoFpsConfig = fps;
  dom.videoFpsValue.textContent = fps + " FPS";

  // Send video config to server (Req 2.9)
  wsSend({
    type: "set_video_config",
    frameRate: fps,
  });
}

/**
 * Updates the FPS slider display value on input (live feedback).
 */
export function onVideoFpsInput() {
  dom.videoFpsValue.textContent = dom.videoFpsSlider.value + " FPS";
}

/**
 * Called when the time limit input changes.
 * Sends set_time_limit message to server.
 */
export function onTimeLimitChange() {
  const seconds = parseInt(dom.timeLimitInput.value, 10);
  if (isNaN(seconds) || seconds < 30) return;

  S.configuredTimeLimit = seconds;

  // Send time limit to server
  wsSend({
    type: "set_time_limit",
    seconds: seconds,
  });

  // Update duration estimate display if we have an estimate
  if (S.estimatedDuration !== null) {
    updateDurationEstimateDisplay(S.estimatedDuration, S.configuredTimeLimit);
  }
}

// ─── Phase 3: VAD Notification Handlers ──────────────────────────

/**
 * Handles vad_speech_end message from the server.
 * Shows the VAD notification banner during RECORDING state.
 * If a second vad_speech_end arrives while banner is visible,
 * replaces the existing banner (resets state) rather than showing
 * a second one (Req 2.8).
 * @param {Object} message - The vad_speech_end message
 */
export function handleVADSpeechEnd(message) {
  // Only show notification during RECORDING state
  if (S.currentState !== SessionState.RECORDING) return;

  // If banner is already visible, reset its state (Req 2.8)
  // This is effectively a no-op visually since the banner text is the same,
  // but it resets any internal state associated with the notification.
  S.vadNotificationVisible = true;
  show(dom.vadNotification);
}

/**
 * Handles "Confirm Stop" button click on the VAD notification banner.
 * Sends stop_recording and dismisses the banner (Req 2.3).
 */
export function onVADConfirmStop() {
  dismissVADNotification();
  // Follow the existing stop recording flow (Req 2.3)
  onStopSpeech();
}

/**
 * Handles "Dismiss" button click on the VAD notification banner.
 * Hides the banner and continues recording (Req 2.4).
 */
export function onVADDismiss() {
  dismissVADNotification();
}

/**
 * Dismisses the VAD notification banner and resets state.
 * Called on Dismiss click, Confirm Stop click, state change away
 * from RECORDING, and manual Stop Speech click (Req 2.4, 2.5, 2.6).
 */

// ─── Phase 3: VAD Config Event Handlers ───────────────────────────

/**
 * Called when the VAD enabled checkbox or silence threshold slider changes.
 * Updates local state and sends set_vad_config message to server.
 * (Req 3.1, 3.2, 3.5)
 */
export function onVADConfigChange() {
  S.vadEnabled = dom.vadEnabledCheckbox.checked;
  S.vadSilenceThreshold = parseInt(dom.vadThresholdSlider.value, 10);

  // When VAD is disabled, immediately fall back to AudioWorklet (Req 10.4 note)
  if (!S.vadEnabled) {
    resetVadEnergyState();
  }

  // Update the displayed value label
  dom.vadThresholdValue.textContent = S.vadSilenceThreshold + "s";

  // Send VAD config to server
  wsSend({
    type: "set_vad_config",
    silenceThresholdSeconds: S.vadSilenceThreshold,
    enabled: S.vadEnabled,
  });
}

/**
 * Called on slider input (live update of displayed value while dragging).
 * Does NOT send a WebSocket message — that happens on change.
 */
export function onVADThresholdInput() {
  dom.vadThresholdValue.textContent = dom.vadThresholdSlider.value + "s";
}

// ─── Phase 3: Project Context Event Handlers ─────────────────────

/**
 * Called when the speech title input changes.
 * Updates local state and sends set_project_context message to server.
 * (Req 4.1, 4.4)
 */
export function onSpeechTitleChange() {
  S.projectContext.speechTitle = dom.speechTitleInput.value.trim();
  saveFormState();
  sendProjectContext();
}

/**
 * Called when the project type dropdown changes.
 * Auto-populates objectives for predefined project types (Req 4.3).
 * Updates local state and sends set_project_context message to server.
 * (Req 4.2, 4.3, 4.4)
 */
export function onProjectTypeChange() {
  const selectedType = dom.projectTypeSelect.value;
  S.projectContext.projectType = selectedType;

  // Auto-populate objectives for predefined project types (Req 4.3)
  if (selectedType && PROJECT_TYPES[selectedType] && PROJECT_TYPES[selectedType].length > 0) {
    const objectives = PROJECT_TYPES[selectedType];
    dom.objectivesTextarea.value = objectives.join("\n");
    S.projectContext.objectives = objectives.slice();
  } else if (selectedType === "") {
    // Cleared selection — clear objectives
    dom.objectivesTextarea.value = "";
    S.projectContext.objectives = [];
  }
  // For "Custom / Other" (empty array), leave objectives as-is so operator can type freely

  saveFormState();
  sendProjectContext();
}

/**
 * Called when the objectives textarea changes.
 * Parses one objective per line, updates local state, and sends to server.
 * (Req 4.1, 4.4)
 */
export function onObjectivesChange() {
  const text = dom.objectivesTextarea.value;
  // Parse objectives: one per line, filter out empty lines
  S.projectContext.objectives = text.split("\n")
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return line.length > 0; });
  saveFormState();
  sendProjectContext();
}

/**
 * Sends the current project context to the server via WebSocket.
 * (Req 4.4)
 */
export function sendProjectContext() {
  wsSend({
    type: "set_project_context",
    speechTitle: S.projectContext.speechTitle,
    projectType: S.projectContext.projectType,
    objectives: S.projectContext.objectives,
  });
}

/**
 * Resets the project context form to its default empty state.
 * Called on data_purged and other reset scenarios.
 */
export function resetProjectContextForm() {
  S.projectContext = { speechTitle: "", projectType: "", objectives: [] };
  dom.speechTitleInput.value = "";
  dom.projectTypeSelect.value = "";
  dom.objectivesTextarea.value = "";
}

// ─── Analysis Tier Event Handlers (#125) ──────────────────────────

/**
 * Called when the analysis tier radio selection changes.
 * Updates local state, persists, and sends set_analysis_tier to server.
 */
export function onAnalysisTierChange() {
  const selected = document.querySelector('input[name="analysis-tier"]:checked');
  if (!selected) return;

  S.analysisTier = selected.value;
  saveFormState();

  wsSend({
    type: "set_analysis_tier",
    tier: S.analysisTier,
  });
}

