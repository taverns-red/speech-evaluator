/**
 * Camera acquisition, frame streaming, quality grade, video UI.
 * Extracted from app.js for ES module pattern (#110).
 */
import { S, dom, videoDom } from "./state.js";
import { SessionState } from "./constants.js";
import { show, hide } from "./utils.js";
import { showNotification } from "./ui.js";
// Circular import — safe (called inside function bodies only)
import { wsSend } from "./websocket.js";

// ─── Phase 4: Video Frame Streaming State (Req 2.1, 2.2, 16.1) ──
/** @type {MediaStream|null} Camera video stream */
/** @type {number|null} Interval ID for frame capture at 5 FPS */
/** Frame sequence number, reset per recording session */
/** performance.now() at recording start — shared time base with audio */
/** Total frames sent this session (for stats display) */
/** Total frames skipped due to backpressure this session */
/** Backpressure threshold: 2 MB */
const VIDEO_BACKPRESSURE_BYTES = 2 * 1024 * 1024;
/** Frame capture interval: 200ms = 5 FPS client cap */
const VIDEO_CAPTURE_INTERVAL_MS = 200;
/** JPEG quality for frame capture (0.0 - 1.0) */
const VIDEO_JPEG_QUALITY = 0.7;

// ─── Phase 4: Video DOM References ────────────────────────────────


/** Current camera facing mode: "user" (front) or "environment" (rear) */
/** Whether multiple cameras are detected (shows flip button) */

/** Last video quality grade from final video_status message */

/**
 * Encodes a video frame into the TM-prefixed wire format for browser.
 * Format: [0x54 0x4D][0x56][uint24 header len][header JSON UTF-8][JPEG bytes]
 *
 * Uses ArrayBuffer/DataView/Uint8Array for browser compatibility (no Node.js Buffer).
 *
 * @param {Object} header - Frame header with timestamp, seq, width, height
 * @param {Uint8Array} jpegBytes - JPEG image data
 * @returns {ArrayBuffer} Encoded binary frame
 */
export function encodeVideoFrameBrowser(header, jpegBytes) {
  var headerJson = JSON.stringify(header);
  var encoder = new TextEncoder();
  var headerBytes = encoder.encode(headerJson);
  var headerLen = headerBytes.length;

  // Total: 2 (magic) + 1 (type) + 3 (header len) + headerLen + jpegBytes.length
  var totalLen = 6 + headerLen + jpegBytes.length;
  var buf = new ArrayBuffer(totalLen);
  var view = new DataView(buf);
  var arr = new Uint8Array(buf);

  // TM magic prefix
  view.setUint8(0, 0x54); // 'T'
  view.setUint8(1, 0x4D); // 'M'
  // Type byte: video
  view.setUint8(2, 0x56); // 'V'
  // uint24 big-endian header length
  view.setUint8(3, (headerLen >> 16) & 0xFF);
  view.setUint8(4, (headerLen >> 8) & 0xFF);
  view.setUint8(5, headerLen & 0xFF);
  // Header JSON bytes
  arr.set(headerBytes, 6);
  // JPEG payload
  arr.set(jpegBytes, 6 + headerLen);

  return buf;
}

/**
 * Acquires camera access via getUserMedia and sets up the video preview.
 * Uses the current facingMode ("user" for front, "environment" for rear).
 * @param {string} [facingMode] - Optional facing mode override
 * @returns {Promise<boolean>} true if camera acquired successfully
 */
export async function acquireCamera(facingMode) {
  var mode = facingMode || S.currentFacingMode;
  try {
    S.videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 10 },
        facingMode: { ideal: mode },
      }
    });
    videoDom.preview.srcObject = S.videoStream;
    show(videoDom.previewContainer);
    // Check for multiple cameras and show/hide flip button
    checkMultipleCameras();
    return true;
  } catch (err) {
    console.warn("[Video] Camera acquisition failed:", err.message);
    S.videoStream = null;
    return false;
  }
}

/**
 * Checks for multiple video input devices and shows/hides the camera
 * flip button accordingly. Called after camera acquisition.
 */
export async function checkMultipleCameras() {
  try {
    var devices = await navigator.mediaDevices.enumerateDevices();
    var videoInputs = devices.filter(function (d) { return d.kind === "videoinput"; });
    S.hasMultipleCameras = videoInputs.length > 1;
    if (S.hasMultipleCameras && videoDom.btnCameraFlip) {
      videoDom.btnCameraFlip.style.display = "";
    } else if (videoDom.btnCameraFlip) {
      videoDom.btnCameraFlip.style.display = "none";
    }
  } catch (err) {
    // If enumerateDevices fails, hide the flip button
    console.warn("[Video] Could not enumerate devices:", err.message);
    S.hasMultipleCameras = false;
    if (videoDom.btnCameraFlip) {
      videoDom.btnCameraFlip.style.display = "none";
    }
  }
}

/**
 * Handles camera flip button click.
 * Toggles between front ("user") and rear ("environment") cameras.
 * Preserves video consent state and does not interrupt audio recording.
 */
export async function onCameraFlip() {
  if (!S.videoConsentEnabled) return;

  // Toggle facing mode
  S.currentFacingMode = S.currentFacingMode === "user" ? "environment" : "user";

  // Release current camera stream (does NOT release audio)
  if (S.videoStream) {
    S.videoStream.getTracks().forEach(function (track) { track.stop(); });
    S.videoStream = null;
  }
  if (videoDom.preview) {
    videoDom.preview.srcObject = null;
  }

  // Acquire new camera with toggled facing mode
  var acquired = await acquireCamera(S.currentFacingMode);
  if (!acquired) {
    // If the new camera fails, revert to the previous mode
    S.currentFacingMode = S.currentFacingMode === "user" ? "environment" : "user";
    acquired = await acquireCamera(S.currentFacingMode);
    if (!acquired) {
      showVideoConsentError("Failed to switch camera. Camera access may have been lost.");
    }
    return;
  }

  // Re-send video_stream_ready with updated dimensions/device label
  if (S.videoStream) {
    var tracks = S.videoStream.getVideoTracks();
    if (tracks.length > 0) {
      var settings = tracks[0].getSettings();
      var readyMsg = {
        type: "video_stream_ready",
        width: settings.width || 0,
        height: settings.height || 0,
      };
      if (tracks[0].label) {
        readyMsg.deviceLabel = tracks[0].label;
      }
      wsSend(readyMsg);
    }
  }
}

/**
 * Starts video frame capture at 5 FPS client cap.
 * Captures JPEG frames from the video element via canvas,
 * encodes them in TM-prefixed wire format, and sends over WebSocket.
 */
export function startVideoCapture() {
  if (!S.videoStream || !videoDom.preview.videoWidth) {
    console.warn("[Video] Cannot start capture — no video stream or video not ready");
    return;
  }

  // Reset per-session counters
  S.videoFrameSeq = 0;
  S.videoFramesSent = 0;
  S.videoFramesSkipped = 0;
  S.lastVideoQualityGrade = null;
  S.recordingStartPerfNow = performance.now();

  // Hide video quality grade from previous session
  if (videoDom.qualityGrade) {
    videoDom.qualityGrade.className = "video-quality-grade";
  }

  var canvas = videoDom.captureCanvas;
  var ctx = canvas.getContext("2d");

  S.videoCaptureInterval = setInterval(function () {
    // Guard: only send during RECORDING state with video consent (Req 2.1, 10.4)
    if (S.currentState !== SessionState.RECORDING) return;
    if (!S.videoConsentEnabled) return;
    // Guard: need open WebSocket
    if (!S.ws || S.ws.readyState !== WebSocket.OPEN) return;
    // Guard: video element must have dimensions
    if (!videoDom.preview.videoWidth || !videoDom.preview.videoHeight) return;

    // Backpressure guard: skip frame if bufferedAmount > 2MB
    if (S.ws.bufferedAmount > VIDEO_BACKPRESSURE_BYTES) {
      S.videoFramesSkipped++;
      updateVideoFrameStats();
      return;
    }

    var vw = videoDom.preview.videoWidth;
    var vh = videoDom.preview.videoHeight;

    // Set canvas to match video dimensions
    canvas.width = vw;
    canvas.height = vh;

    // Draw current video frame to canvas
    ctx.drawImage(videoDom.preview, 0, 0, vw, vh);

    // Convert to JPEG blob via toBlob for async, non-blocking encoding
    canvas.toBlob(function (blob) {
      if (!blob) return;
      // Guard again — state or consent may have changed during async toBlob
      if (S.currentState !== SessionState.RECORDING) return;
      if (!S.videoConsentEnabled) return;
      if (!S.ws || S.ws.readyState !== WebSocket.OPEN) return;
      if (S.ws.bufferedAmount > VIDEO_BACKPRESSURE_BYTES) {
        S.videoFramesSkipped++;
        updateVideoFrameStats();
        return;
      }

      // Read blob as ArrayBuffer
      var reader = new FileReader();
      reader.onload = function () {
        // Final guard after async read — verify state and consent
        if (S.currentState !== SessionState.RECORDING) return;
        if (!S.videoConsentEnabled) return;
        if (!S.ws || S.ws.readyState !== WebSocket.OPEN) return;

        var jpegBytes = new Uint8Array(reader.result);

        // Build header with timestamp relative to recording start
        var header = {
          timestamp: (performance.now() - S.recordingStartPerfNow) / 1000,
          seq: S.videoFrameSeq++,
          width: vw,
          height: vh
        };

        // Encode in TM-prefixed wire format and send as binary
        var encoded = encodeVideoFrameBrowser(header, jpegBytes);
        S.ws.send(encoded);

        S.videoFramesSent++;
        updateVideoFrameStats();
      };
      reader.readAsArrayBuffer(blob);
    }, "image/jpeg", VIDEO_JPEG_QUALITY);
  }, VIDEO_CAPTURE_INTERVAL_MS);
}

/**
 * Stops video frame capture.
 */
export function stopVideoCapture() {
  if (S.videoCaptureInterval !== null) {
    clearInterval(S.videoCaptureInterval);
    S.videoCaptureInterval = null;
  }
}

/**
 * Releases the camera stream and hides the preview.
 */
export function releaseCamera() {
  stopVideoCapture();
  if (S.videoStream) {
    S.videoStream.getTracks().forEach(function (track) { track.stop(); });
    S.videoStream = null;
  }
  if (videoDom.preview) {
    videoDom.preview.srcObject = null;
  }
  hide(videoDom.previewContainer);
  // Reset camera toggle state (#51)
  S.currentFacingMode = "user";
  S.hasMultipleCameras = false;
  if (videoDom.btnCameraFlip) {
    videoDom.btnCameraFlip.style.display = "none";
  }
}

/**
 * Updates the video frame stats display.
 */
export function updateVideoFrameStats() {
  if (videoDom.frameStats) {
    videoDom.frameStats.textContent = "Sent: " + S.videoFramesSent + " / Skipped: " + S.videoFramesSkipped;
  }
}

/**
 * Handles video_status messages from the server.
 * Updates the video frame stats display during recording. (Req 10.8, 17.1)
 * Shows frames processed/dropped, latency warning if >500ms,
 * and captures video quality grade from final status after stop_recording.
 * @param {Object} message - The video_status message
 */
export function handleVideoStatus(message) {
  // Capture video quality grade from final status (present after stop_recording)
  if (message.videoQualityGrade) {
    S.lastVideoQualityGrade = message.videoQualityGrade;
  }

  // Show server-side frame stats during recording
  if (videoDom.frameStats && S.currentState === SessionState.RECORDING) {
    const processed = message.framesProcessed || 0;
    const dropped = message.framesDropped || 0;
    const latency = message.processingLatencyMs || 0;
    let text = "Processed: " + processed + " / Dropped: " + dropped;
    if (latency > 500) {
      text += " ⚠️";
    }
    videoDom.frameStats.textContent = text;
    if (latency > 500) {
      videoDom.frameStats.title = "Processing latency: " + Math.round(latency) + "ms (high)";
    } else {
      videoDom.frameStats.title = "";
    }
  }

  // Show video quality grade after evaluation (final status message)
  if (message.videoQualityGrade) {
    showVideoQualityGrade(message.videoQualityGrade);
  }
}

/**
 * Displays the video quality grade badge in the evaluation panel header.
 * @param {"good"|"degraded"|"poor"} grade
 */
export function showVideoQualityGrade(grade) {
  if (!videoDom.qualityGrade) return;
  videoDom.qualityGrade.className = "video-quality-grade visible " + grade;
  var labels = { good: "Video: Good", degraded: "Video: Degraded", poor: "Video: Poor" };
  videoDom.qualityGrade.textContent = labels[grade] || "Video: " + grade;
}

// ─── Video Preview Toggle ─────────────────────────────────────────

export function toggleVideoSize() {
  const preview = document.getElementById("video-preview");
  const btn = document.getElementById("btn-video-toggle");
  if (preview.classList.toggle("expanded")) {
    btn.textContent = "⤡";
    btn.title = "Collapse video preview";
  } else {
    btn.textContent = "⤢";
    btn.title = "Expand video preview";
  }
}

// ─── Vision Tier Frame Capture (#128) ─────────────────────────────
// Separate from Phase 4 ML frames (5fps binary TM-prefixed).
// Vision frames are low-frequency canvas snapshots sent as JSON
// for GPT-4o Vision analysis at evaluation time.

/** @type {number|null} Interval ID for Vision frame capture */
let visionCaptureIntervalId = null;
/** Number of Vision frames captured this session */
let visionFramesCaptured = 0;

// Tier configs (sampling interval in seconds) — must match backend
const VISION_TIER_CONFIGS = {
  standard: { vision: false, samplingIntervalSeconds: 0, maxFrames: 0 },
  enhanced: { vision: true, samplingIntervalSeconds: 10, maxFrames: 120 },
  detailed: { vision: true, samplingIntervalSeconds: 5, maxFrames: 360 },
  maximum:  { vision: true, samplingIntervalSeconds: 1, maxFrames: 600 },
};

/**
 * Starts Vision frame capture for GPT-4o analysis.
 * Captures canvas snapshots at the tier's configured interval
 * and sends them as JSON { type: "vision_frame", data: "<base64>" }.
 *
 * Does nothing if tier has vision=false or no video stream.
 */
export function startVisionCapture() {
  stopVisionCapture(); // Ensure no double-start

  const tierConfig = VISION_TIER_CONFIGS[S.analysisTier] || VISION_TIER_CONFIGS.standard;
  if (!tierConfig.vision || tierConfig.samplingIntervalSeconds <= 0) return;
  if (!S.videoStream || !videoDom.preview.videoWidth) {
    console.warn("[Vision] Cannot start — no video stream");
    return;
  }

  visionFramesCaptured = 0;
  const intervalMs = tierConfig.samplingIntervalSeconds * 1000;
  const maxFrames = tierConfig.maxFrames;

  const canvas = videoDom.captureCanvas;
  const ctx = canvas.getContext("2d");

  visionCaptureIntervalId = setInterval(() => {
    // Guards
    if (S.currentState !== SessionState.RECORDING) return;
    if (!S.ws || S.ws.readyState !== WebSocket.OPEN) return;
    if (!videoDom.preview.videoWidth) return;
    if (visionFramesCaptured >= maxFrames) {
      console.log(`[Vision] Max frames reached (${maxFrames}), stopping capture`);
      stopVisionCapture();
      return;
    }

    const vw = videoDom.preview.videoWidth;
    const vh = videoDom.preview.videoHeight;
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(videoDom.preview, 0, 0, vw, vh);

    // Convert to base64 JPEG
    const dataUrl = canvas.toDataURL("image/jpeg", VIDEO_JPEG_QUALITY);

    // Send as JSON message
    wsSend({
      type: "vision_frame",
      data: dataUrl,
      seq: visionFramesCaptured,
    });

    visionFramesCaptured++;
  }, intervalMs);

  console.log(`[Vision] Started capture: tier=${S.analysisTier}, interval=${tierConfig.samplingIntervalSeconds}s, maxFrames=${maxFrames}`);
}

/**
 * Stops Vision frame capture.
 */
export function stopVisionCapture() {
  if (visionCaptureIntervalId !== null) {
    clearInterval(visionCaptureIntervalId);
    visionCaptureIntervalId = null;
  }
  if (visionFramesCaptured > 0) {
    console.log(`[Vision] Stopped. Captured ${visionFramesCaptured} frames`);
  }
}

