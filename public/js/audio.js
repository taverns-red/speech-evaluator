/**
 * Mic capture, AudioWorklet, cooldown, speech recording.
 * Extracted from app.js for ES module pattern (#110).
 */
import { S, dom } from "./state.js";
import { SessionState, COOLDOWN_MS, STATUS_TEXT } from "./constants.js";
import { show, hide, enable, disable } from "./utils.js";
import { updateUI, updateAudioLevel, checkVadEnergyFallback, showError } from "./ui.js";
import { stopVideoCapture, stopVisionCapture } from "./video.js";
// Circular import — safe (called inside function bodies only)
import { wsSend } from "./websocket.js";

// ─── Audio Capture: Mic + AudioWorklet ────────────────────────────

/**
 * Requests microphone permission and checks for available audio input devices.
 * @returns {Promise<boolean>} true if mic is available and permission granted
 */
export async function checkMicPermission() {
  try {
    // Check for available audio input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(function (d) { return d.kind === "audioinput"; });
    if (audioInputs.length === 0) {
      showError("No microphone detected. Please connect a microphone and refresh.", false);
      disable(dom.btnStart);
      return false;
    }
    return true;
  } catch (err) {
    showError("Cannot access media devices: " + err.message, false);
    disable(dom.btnStart);
    return false;
  }
}

/**
 * Starts audio capture: requests mic, creates AudioContext + AudioWorklet,
 * and begins streaming audio chunks to the server via WebSocket.
 * @returns {Promise<boolean>} true if audio capture started successfully
 */
export async function startAudioCapture() {
  try {
    // Request mic permission
    S.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create AudioContext (or reuse if already created)
    if (!S.audioContext || S.audioContext.state === "closed") {
      S.audioContext = new AudioContext();
    }
    // Resume if suspended (browsers require user gesture)
    if (S.audioContext.state === "suspended") {
      await S.audioContext.resume();
    }

    // Load the AudioWorklet processor module
    await S.audioContext.audioWorklet.addModule("audio-worklet.js?v=2");

    // Create source node from mic stream
    S.sourceNode = S.audioContext.createMediaStreamSource(S.mediaStream);

    // Create AudioWorklet node
    S.workletNode = new AudioWorkletNode(S.audioContext, "audio-capture-processor");

    // Listen for audio chunks from the worklet
    S.workletNode.port.onmessage = function (event) {
      if (event.data && event.data.type === "audio_chunk") {
        // Check if VAD energy has gone stale and we need to fall back (Req 10.4)
        checkVadEnergyFallback();
        // Update audio level meter (skipped if VAD energy is active, Req 10.3)
        if (typeof event.data.level === "number") {
          updateAudioLevel(event.data.level);
        }
        // Send audio chunk as binary WebSocket frame
        if (S.ws && S.ws.readyState === WebSocket.OPEN && S.currentState === SessionState.RECORDING) {
          S.ws.send(event.data.samples);
        }
      }
    };

    // Connect the pipeline: mic → worklet (worklet doesn't output to speakers)
    S.sourceNode.connect(S.workletNode);
    // Connect worklet to destination to keep the audio graph alive
    // (AudioWorklet needs to be connected to process)
    S.workletNode.connect(S.audioContext.destination);

    // Start MediaRecorder to capture original speech (#60)
    S.speechRecordingChunks = [];
    S.speechRecordingBlob = null;
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : ""; // browser default
      const recorderOptions = mimeType ? { mimeType } : {};
      S.speechRecorder = new MediaRecorder(S.mediaStream, recorderOptions);
      S.speechRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) S.speechRecordingChunks.push(e.data);
      };
      S.speechRecorder.onstop = function () {
        if (S.speechRecordingChunks.length > 0) {
          S.speechRecordingBlob = new Blob(S.speechRecordingChunks, { type: S.speechRecorder.mimeType });
        }
        S.speechRecorder = null;
      };
      S.speechRecorder.start(1000); // 1-second chunks for memory efficiency
      console.log("[MediaRecorder] Started:", S.speechRecorder.mimeType);
    } catch (recErr) {
      console.warn("[MediaRecorder] Could not start recording:", recErr);
      // Non-fatal — the session still works, just without recording
    }

    return true;
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      showError("Microphone permission denied. Please allow microphone access and try again.", false);
    } else if (err.name === "NotFoundError") {
      showError("No microphone found. Please connect a microphone and try again.", false);
    } else {
      showError("Failed to start audio capture: " + err.message, true);
    }
    disable(dom.btnStart);
    return false;
  }
}

/**
 * Stops the AudioWorklet and disconnects the audio graph.
 * Keeps the MediaStream alive for potential restart.
 */
export function stopAudioCapture() {
  // Stop MediaRecorder (#60)
  if (S.speechRecorder && S.speechRecorder.state !== "inactive") {
    S.speechRecorder.stop();
    console.log("[MediaRecorder] Stopped");
  }

  if (S.workletNode) {
    // Tell the worklet processor to stop
    S.workletNode.port.postMessage({ type: "stop" });
    S.workletNode.disconnect();
    S.workletNode = null;
  }
  if (S.sourceNode) {
    S.sourceNode.disconnect();
    S.sourceNode = null;
  }
}

/**
 * Hard-stops the MediaStream tracks immediately.
 * Used for panic mute and echo prevention during DELIVERING state.
 * After this, a new getUserMedia call is needed to re-arm the mic.
 */
export function hardStopMic() {
  // Stop the AudioWorklet first
  stopAudioCapture();

  // Phase 4: Stop video frame capture (echo prevention — no video during delivery)
  stopVideoCapture();
  // Sprint C2: Stop Vision capture (#128)
  stopVisionCapture();

  // Hard-stop all MediaStream tracks (not just mute — fully release the mic)
  if (S.mediaStream) {
    S.mediaStream.getTracks().forEach(function (track) {
      track.stop();
    });
    S.mediaStream = null;
  }
}

// ─── Cooldown Logic ───────────────────────────────────────────────
// After TTS completes, wait 2-3 seconds before allowing mic re-arm.
// This prevents the system from capturing its own TTS echo.

/**
 * Starts the post-TTS cooldown period.
 * During cooldown, the "Start Speech" button is disabled.
 */
export function startCooldown() {
  S.inCooldown = true;
  disable(dom.btnStart);
  dom.statusText.textContent = "Cooldown — mic re-arming shortly...";

  S.cooldownTimer = setTimeout(function () {
    S.inCooldown = false;
    S.cooldownTimer = null;
    // Re-enable Start Speech only if consent is confirmed
    if (S.consentConfirmed && S.consentSpeakerName.trim().length > 0) {
      enable(dom.btnStart);
    }
    if (S.hasTTSAudio && S.hasEvaluationData && !S.dataPurged) {
      enable(dom.btnReplay);
    }
    dom.statusText.textContent = STATUS_TEXT[SessionState.IDLE];
  }, COOLDOWN_MS);
}

/**
 * Cancels any active cooldown (e.g., on panic mute during cooldown).
 */
export function clearCooldown() {
  if (S.cooldownTimer) {
    clearTimeout(S.cooldownTimer);
    S.cooldownTimer = null;
  }
  S.inCooldown = false;
}

