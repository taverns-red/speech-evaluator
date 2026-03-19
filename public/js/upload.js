/**
 * Upload flow (GCS + legacy), progress UI, pipeline stepper, thumbnail.
 * Extracted from app.js for ES module pattern (#110).
 */
import { S, dom } from "./state.js";
import { SessionState, MAX_UPLOAD_SIZE_MB } from "./constants.js";
import { show, hide, formatTimestamp, escapeHtml } from "./utils.js";
import { updateUI, showError, showNotification, buildZip } from "./ui.js";
import { showEvaluation, displayRoleResults, renderEvaluationWithEvidence } from "./transcript.js";
// Circular import — safe (called inside function bodies only)
import { wsSend } from "./websocket.js";

// ─── Upload Flow ──────────────────────────────────────────────────────

// ─── Form file state ──────────────────────────────────────────────

export function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Require consent before upload
  if (!S.consentConfirmed || S.consentSpeakerName.trim().length === 0) {
    showNotification("Please fill in the consent form before uploading.", "warning");
    event.target.value = "";
    return;
  }

  // Client-side file size pre-check
  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > MAX_UPLOAD_SIZE_MB) {
    showNotification(
      `File too large (${fileSizeMB.toFixed(0)}MB). Maximum: ${MAX_UPLOAD_SIZE_MB}MB.`,
      "error",
      8000
    );
    event.target.value = "";
    return;
  }



  uploadVideo(file);
  event.target.value = ""; // Reset input for re-uploads
}

export function onFormFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Read as base64
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(",")[1]; // strip data:...;base64,
    S.pendingFormFile = { file, base64, mimeType: file.type || "text/plain" };
    const label = document.getElementById("form-file-label");
    if (label) {
      label.textContent = `📋 ${file.name}`;
      label.style.display = "inline";
    }
    showNotification(`Evaluation form attached: ${file.name}`, "success");
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

// ─── Upload Progress State (Sprint 7: #95 #97 #98) ──────────────

export function startUploadTimer() {
  S.uploadStartTime = Date.now();
  S.uploadProgressSamples.length = 0;
  const elapsedEl = document.getElementById("upload-elapsed");
  if (S.uploadElapsedInterval) clearInterval(S.uploadElapsedInterval);
  S.uploadElapsedInterval = setInterval(() => {
    if (!S.uploadStartTime) return;
    const elapsed = Math.floor((Date.now() - S.uploadStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    elapsedEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }, 1000);
}

export function stopUploadTimer() {
  if (S.uploadElapsedInterval) { clearInterval(S.uploadElapsedInterval); S.uploadElapsedInterval = null; }
  S.activeUploadXHR = null;
}

export function computeSpeedAndETA(loaded, total) {
  const now = Date.now();
  const last = S.uploadProgressSamples[S.uploadProgressSamples.length - 1];
  // Throttle: only add sample if ≥200ms since last (prevents rapid XHR events
  // from filling the window with sub-millisecond deltas that never compute)
  if (!last || (now - last.time) >= 200) {
    S.uploadProgressSamples.push({ time: now, loaded });
    // Keep last 10 samples for smoothing (~2s window at 200ms throttle)
    while (S.uploadProgressSamples.length > 10) S.uploadProgressSamples.shift();
  }
  if (S.uploadProgressSamples.length < 2) return { speed: "Calculating...", eta: null };
  const first = S.uploadProgressSamples[0];
  const newest = S.uploadProgressSamples[S.uploadProgressSamples.length - 1];
  const dtSec = (newest.time - first.time) / 1000;
  if (dtSec < 0.2) return { speed: "Calculating...", eta: null };
  const bytesPerSec = (newest.loaded - first.loaded) / dtSec;
  const speed = bytesPerSec > 0 ? (bytesPerSec / 1024 / 1024).toFixed(1) + " MB/s" : null;
  const remaining = total - loaded;
  const etaSec = bytesPerSec > 0 ? Math.ceil(remaining / bytesPerSec) : null;
  let eta = null;
  if (etaSec !== null) {
    if (etaSec > 60) eta = `~${Math.ceil(etaSec / 60)} min remaining`;
    else eta = `~${etaSec}s remaining`;
  }
  return { speed, eta };
}

export function updateUploadProgress(stage, progress, message) {
  const container = document.getElementById("upload-progress");
  const bar = document.getElementById("upload-progress-bar");
  const stageEl = document.getElementById("upload-progress-stage");
  const msgEl = document.getElementById("upload-progress-message");
  const cancelBtn = document.getElementById("upload-cancel-btn");

  container.classList.remove("hidden");
  bar.style.width = progress + "%";
  stageEl.textContent = stage;
  msgEl.textContent = message;

  // Show cancel button during upload/processing, hide on complete/error
  if (stage === "Complete" || stage === "Error") {
    cancelBtn.style.display = "none";
    stopUploadTimer();
  } else {
    cancelBtn.style.display = "inline-block";
  }

  // Pipeline step activation (#96)
  updatePipelineSteps(stage);
}

// Map upload stages to pipeline step data-step values
const PIPELINE_STAGE_MAP = {
  "Initializing": "Uploading",
  "Uploading": "Uploading",
  "Retrying": "Uploading",
  "Processing": "Extracting",
  "Extracting": "Extracting",
  "Transcribing": "Transcribing",
  "Evaluating": "Evaluating",
  "Complete": "Complete",
};

const PIPELINE_ORDER = ["Uploading", "Extracting", "Transcribing", "Evaluating", "Complete"];

export function updatePipelineSteps(stage) {
  const activeStep = PIPELINE_STAGE_MAP[stage] || null;
  const activeIdx = activeStep ? PIPELINE_ORDER.indexOf(activeStep) : -1;

  const steps = document.querySelectorAll("#upload-pipeline .pipeline-step");
  const lines = document.querySelectorAll("#upload-pipeline .pipeline-line");

  steps.forEach((stepEl, i) => {
    stepEl.classList.remove("active", "completed");
    const stepIdx = PIPELINE_ORDER.indexOf(stepEl.dataset.step);
    if (stepIdx === activeIdx) stepEl.classList.add("active");
    else if (stepIdx < activeIdx) stepEl.classList.add("completed");
  });

  lines.forEach((lineEl, i) => {
    lineEl.classList.remove("completed");
    if (i < activeIdx) lineEl.classList.add("completed");
  });
}

// File thumbnail preview (#99)
let thumbnailObjectUrl = null;

export function showUploadThumbnail(file) {
  const container = document.getElementById("upload-thumbnail-container");
  const video = document.getElementById("upload-thumbnail-video");
  const nameEl = document.getElementById("upload-thumbnail-name");

  if (thumbnailObjectUrl) { URL.revokeObjectURL(thumbnailObjectUrl); thumbnailObjectUrl = null; }

  if (file.type.startsWith("video/")) {
    thumbnailObjectUrl = URL.createObjectURL(file);
    video.src = thumbnailObjectUrl;
    video.style.display = "block";
  } else {
    video.style.display = "none";
  }
  nameEl.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  container.style.display = "block";
}

export function hideUploadThumbnail() {
  document.getElementById("upload-thumbnail-container").style.display = "none";
  if (thumbnailObjectUrl) { URL.revokeObjectURL(thumbnailObjectUrl); thumbnailObjectUrl = null; }
}

export function updateSpeedETA(speed, eta) {
  const el = document.getElementById("upload-speed-eta");
  const parts = [];
  if (speed) parts.push(speed);
  if (eta) parts.push(eta);
  el.textContent = parts.join(" — ");
}

export function hideUploadProgress() {
  document.getElementById("upload-progress").classList.add("hidden");
  document.getElementById("upload-speed-eta").textContent = "";
  document.getElementById("upload-elapsed").textContent = "";
  stopUploadTimer();
  hideUploadThumbnail();
  updatePipelineSteps(""); // Reset
}

// Cancel button handler (#98)
document.getElementById("upload-cancel-btn").addEventListener("click", () => {
  if (S.activeUploadXHR) {
    S.activeUploadXHR.abort();
  }
  updateUploadProgress("Error", 0, "Upload cancelled by user");
  stopUploadTimer();
  // Re-enable upload buttons
  const btnUpload = document.getElementById("btn-upload");
  const btnStart = document.getElementById("btn-start");
  if (btnUpload) { btnUpload.disabled = false; btnUpload.textContent = "📁 Upload Video/Audio"; }
  if (btnStart) btnStart.disabled = false;
});

/**
 * Two-phase GCS upload: init → PUT to GCS → process.
 * Uses XMLHttpRequest for real upload progress tracking.
 */
export async function uploadViaGCS(file, metadata) {
  // Step 1: Get signed URL from server
  const initResponse = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      ...metadata,
    }),
  });

  if (initResponse.status === 404) {
    throw new Error("GCS upload not available");
  }

  const initResult = await initResponse.json();
  if (!initResponse.ok || initResult.status === "error") {
    throw new Error(initResult.error || "Failed to initialize upload");
  }

  const { uploadUrl, objectId } = initResult;

  // Step 2: Upload directly to GCS via XHR with retry (#100)
  updateUploadProgress("Uploading", 10, `Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);

  const MAX_UPLOAD_RETRIES = 3;
  let uploadAttempt = 0;

  while (true) {
    uploadAttempt++;
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        S.activeUploadXHR = xhr;
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 60) + 10;
            const loadedMB = (event.loaded / 1024 / 1024).toFixed(1);
            const totalMB = (event.total / 1024 / 1024).toFixed(1);
            const { speed, eta } = computeSpeedAndETA(event.loaded, event.total);
            const retryLabel = uploadAttempt > 1 ? ` (retry ${uploadAttempt - 1})` : "";
            updateUploadProgress("Uploading", pct, `${loadedMB}MB / ${totalMB}MB uploaded${retryLabel}`);
            updateSpeedETA(speed, eta);
          }
        };

        xhr.onload = () => {
          S.activeUploadXHR = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload to storage failed (HTTP ${xhr.status})`));
          }
        };
        xhr.onerror = () => { S.activeUploadXHR = null; reject(new Error("Upload to storage failed (network error)")); };
        xhr.onabort = () => { S.activeUploadXHR = null; reject(new Error("Upload cancelled")); };
        xhr.send(file);
      });
      break; // Success — exit retry loop
    } catch (uploadErr) {
      // Don't retry user-initiated cancels
      if (uploadErr.message === "Upload cancelled") throw uploadErr;
      // Don't retry HTTP errors (only network errors)
      if (!uploadErr.message.includes("network error")) throw uploadErr;
      if (uploadAttempt >= MAX_UPLOAD_RETRIES) throw uploadErr;

      // Exponential backoff: 2s, 4s, 8s
      const delaySec = Math.pow(2, uploadAttempt);
      updateUploadProgress("Retrying", 10, `Network error — retrying in ${delaySec}s (attempt ${uploadAttempt + 1}/${MAX_UPLOAD_RETRIES})...`);
      updateSpeedETA(null, null);
      S.uploadProgressSamples.length = 0; // Reset speed samples
      await new Promise(r => setTimeout(r, delaySec * 1000));
    }
  }

  // Step 3: Trigger server-side processing
  updateUploadProgress("Processing", 75, "Extracting audio, transcribing, and evaluating...");

  const processBody = {
      objectId,
      ...metadata,
    };

  // Attach evaluation form if provided
  if (S.pendingFormFile) {
    processBody.evaluationFormBase64 = S.pendingFormFile.base64;
    processBody.evaluationFormMimeType = S.pendingFormFile.mimeType;
    updateUploadProgress("Processing", 75, "Processing with evaluation form...");
  }

  const processResponse = await fetch("/api/upload/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(processBody),
  });

  const result = await processResponse.json();
  if (!processResponse.ok || result.status === "error") {
    throw new Error(result.error || `Processing failed (HTTP ${processResponse.status})`);
  }

  return result;
}

/**
 * Legacy direct upload via multipart POST (for files < 32MB or when GCS is unavailable).
 */
export async function uploadLegacy(file, metadata) {
  updateUploadProgress("Uploading", 10, `Sending ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("speakerName", metadata.speakerName);
  if (metadata.speechTitle) formData.append("speechTitle", metadata.speechTitle);
  if (metadata.projectType) formData.append("projectType", metadata.projectType);
  if (metadata.objectives) formData.append("objectives", metadata.objectives);

  // Include evaluation form if attached
  if (S.pendingFormFile) {
    formData.append("evaluationFormBase64", S.pendingFormFile.base64);
    formData.append("evaluationFormMimeType", S.pendingFormFile.mimeType);
  }

  // Use XHR instead of fetch for upload progress tracking (#95)
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    S.activeUploadXHR = xhr;
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 50) + 10; // 10-60%
        const loadedMB = (event.loaded / 1024 / 1024).toFixed(1);
        const totalMB = (event.total / 1024 / 1024).toFixed(1);
        const { speed, eta } = computeSpeedAndETA(event.loaded, event.total);
        updateUploadProgress("Uploading", pct, `${loadedMB}MB / ${totalMB}MB uploaded`);
        updateSpeedETA(speed, eta);
      }
    };

    xhr.onload = () => {
      S.activeUploadXHR = null;
      updateUploadProgress("Analyzing", 70, "Generating evaluation...");
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.status !== "error") {
          resolve(data);
        } else if (xhr.status === 413) {
          reject(new Error(`File too large for direct upload (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum: 32MB.`));
        } else {
          reject(new Error(data.error || `Upload failed (HTTP ${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => { S.activeUploadXHR = null; reject(new Error("Upload failed (network error)")); };
    xhr.onabort = () => { S.activeUploadXHR = null; reject(new Error("Upload cancelled")); };
    xhr.send(formData);
  });

  return result;
}

export async function uploadVideo(file) {
  const btnUpload = document.getElementById("btn-upload");
  const btnStart = document.getElementById("btn-start");

  try {
    // Disable buttons during upload
    btnUpload.disabled = true;
    btnStart.disabled = true;
    btnUpload.textContent = "⏳ Processing...";

    // Gather project context
    const speechTitle = document.getElementById("speech-title")?.value;
    const projectType = document.getElementById("project-type")?.value;
    const objectives = document.getElementById("objectives")?.value;

    const metadata = {
      speakerName: S.consentSpeakerName,
      speechTitle: speechTitle || undefined,
      projectType: projectType || undefined,
      objectives: objectives || undefined,
    };

    startUploadTimer();
    showUploadThumbnail(file);
    updateUploadProgress("Initializing", 5, "Preparing upload...");

    // ── Try GCS two-phase upload first ──
    let result;
    try {
      result = await uploadViaGCS(file, metadata);
    } catch (gcsErr) {
      // Fall back to legacy direct upload if GCS is unavailable (404)
      // or fails to initialize (e.g., no service account credentials locally)
      console.log("GCS upload failed, falling back to legacy direct upload:", gcsErr.message);
      result = await uploadLegacy(file, metadata);
    }

    const response = result;

    updateUploadProgress("Complete", 100, `Processed ${result.durationSeconds?.toFixed(0) || "?"}s of speech — ${result.transcript?.length || 0} S.segments`);

    // ── Make panels visible ──
    const transcriptPanel = document.getElementById("transcript-panel");
    const evaluationPanel = document.getElementById("evaluation-panel");
    if (transcriptPanel) transcriptPanel.classList.add("visible");
    if (evaluationPanel) evaluationPanel.classList.add("visible");

    // ── Populate transcript panel ──
    if (result.transcript && result.transcript.length > 0) {
      const transcriptEl = document.getElementById("transcript-content");
      if (transcriptEl) {
        const text = result.transcript.map(s => s.text).join(" ");
        transcriptEl.innerHTML = `<p>${text}</p>`;
      }
    }

    // ── Populate evaluation panel ──
    if (result.evaluation) {
      const evalEl = document.getElementById("evaluation-content");
      if (evalEl) {
        evalEl.innerHTML = formatUploadedEvaluation(result.evaluation, result.metrics, result.passRate);
      }
    }

    // ── Display completed evaluation form ──
    if (result.evaluation?.completed_form) {
      const evalEl = document.getElementById("evaluation-content");
      if (evalEl) {
        const formSection = document.createElement("div");
        formSection.style.cssText = "margin-top: 20px; padding: 16px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color);";
        formSection.innerHTML = `
          <h3 style="margin: 0 0 12px; color: var(--text-primary);">📋 Completed Evaluation Form</h3>
          <pre style="white-space: pre-wrap; font-family: inherit; font-size: 0.9em; color: var(--text-secondary); margin: 0;">${result.evaluation.completed_form.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        `;
        evalEl.appendChild(formSection);
      }
    }

    // Clean up form state
    S.pendingFormFile = null;
    const formLabel = document.getElementById("form-file-label");
    if (formLabel) { formLabel.textContent = ""; formLabel.style.display = "none"; }

    // ── Play TTS if available ──
    if (result.ttsAudio) {
      try {
        const audioData = Uint8Array.from(atob(result.ttsAudio), c => c.charCodeAt(0));
        const audioBlob = new Blob([audioData], { type: "audio/mp3" });
        const audioUrl = URL.createObjectURL(audioBlob);
        window._uploadTtsAudio = new Audio(audioUrl);

        // Add play button to the evaluation panel
        const evalEl = document.getElementById("evaluation-content");
        if (evalEl) {
          const playBtn = document.createElement("button");
          playBtn.className = "btn";
          playBtn.style.cssText = "margin-top: 16px; width: 100%;";
          playBtn.innerHTML = "🔊 Play Spoken Evaluation";
          playBtn.onclick = () => {
            if (window._uploadTtsAudio) {
              if (window._uploadTtsAudio.paused) {
                window._uploadTtsAudio.play();
                playBtn.innerHTML = "⏸ Pause Evaluation";
              } else {
                window._uploadTtsAudio.pause();
                playBtn.innerHTML = "🔊 Play Spoken Evaluation";
              }
            }
          };
          window._uploadTtsAudio.onended = () => {
            playBtn.innerHTML = "🔊 Replay Spoken Evaluation";
          };
          evalEl.appendChild(playBtn);
        }
        showNotification("Evaluation ready! Click 🔊 to listen.", "success");
      } catch (e) {
        console.warn("TTS playback error:", e);
      }
    }

    // ── Download button ──
    {
      const evalEl = document.getElementById("evaluation-content");
      if (evalEl) {
        const dlBtn = document.createElement("button");
        dlBtn.className = "btn";
        dlBtn.style.cssText = "margin-top: 8px; width: 100%;";
        dlBtn.innerHTML = "💾 Download Evaluation";
        dlBtn.onclick = () => {
          const speakerName = (S.consentSpeakerName || "speaker").replace(/[^a-zA-Z0-9_-]/g, "_");
          const dateStr = new Date().toISOString().slice(0, 10);
          const zipName = `speech-evaluation_${speakerName}_${dateStr}.zip`;

          // Build file contents
          const files = [];

          // Transcript
          if (result.transcript && result.transcript.length > 0) {
            const text = result.transcript.map(s => s.text).join("\n\n");
            files.push({ name: "transcript.txt", content: text });
          }

          // Evaluation
          if (result.evaluation) {
            let evalText = "";
            if (result.evaluation.opening) evalText += result.evaluation.opening + "\n\n";
            for (const item of (result.evaluation.items || [])) {
              evalText += `[${item.type.toUpperCase()}] ${item.summary}\n`;
              if (item.explanation) evalText += `  ${item.explanation}\n`;
              if (item.evidence_quote) evalText += `  Quote: "${item.evidence_quote}"\n`;
              evalText += "\n";
            }
            if (result.evaluation.closing) evalText += result.evaluation.closing + "\n";
            if (result.passRate !== undefined) evalText += `\nEvidence pass rate: ${(result.passRate * 100).toFixed(0)}%\n`;
            files.push({ name: "evaluation.txt", content: evalText });
          }

          // Completed evaluation form
          if (result.evaluation?.completed_form) {
            files.push({ name: "completed_evaluation_form.txt", content: result.evaluation.completed_form });
          }

          // Metrics
          if (result.metrics) {
            let metricsText = "Speech Metrics\n==============\n\n";
            metricsText += `Total words: ${result.metrics.totalWords || 0}\n`;
            metricsText += `WPM: ${Math.round(result.metrics.wordsPerMinute || 0)}\n`;
            metricsText += `Duration: ${result.durationSeconds?.toFixed(0) || "?"}s\n`;
            if (result.metrics.fillerWordCount !== undefined) metricsText += `Filler words: ${result.metrics.fillerWordCount}\n`;
            files.push({ name: "metrics.txt", content: metricsText });
          }

          // TTS audio
          if (result.ttsAudio) {
            files.push({ name: "evaluation_audio.mp3", content: result.ttsAudio, encoding: "base64" });
          }

          if (files.length === 0) {
            showNotification("No data to download.", "warning");
            return;
          }

          // Reuse existing buildZip (expects {name, content} with content as string)
          const zipBytes = buildZip(files);
          const zipBlob = new Blob([zipBytes], { type: "application/zip" });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = zipName;
          a.click();
          URL.revokeObjectURL(url);
          showNotification("Evaluation downloaded!", "success");
        };
        evalEl.appendChild(dlBtn);
      }
    }

    showNotification("Upload evaluation complete!", "success");

    // Hide progress after 5s
    setTimeout(hideUploadProgress, 5000);

  } catch (err) {
    updateUploadProgress("Error", 0, err.message);
    showNotification("Upload failed: " + err.message, "error");
    setTimeout(hideUploadProgress, 8000);
  } finally {
    btnUpload.disabled = false;
    btnStart.disabled = false;
    btnUpload.textContent = "📁 Upload Video";
  }
}

export function formatUploadedEvaluation(evaluation, metrics, passRate) {
  let html = '<div class="evaluation-uploaded">';

  // Opening
  if (evaluation.opening) {
    html += `<p style="margin-bottom:16px; color: var(--text-secondary, #b0b0b0);">${evaluation.opening}</p>`;
  }

  if (evaluation.items && Array.isArray(evaluation.items)) {
    for (const item of evaluation.items) {
      const icon = item.type === "commendation" ? "✅" : "💡";
      html += `<div style="margin-bottom: 16px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03);">`;
      html += `<strong>${icon} ${item.summary || item.type}</strong>`;
      if (item.explanation) {
        html += `<p style="margin: 8px 0 4px; color: var(--text-secondary, #b0b0b0);">${item.explanation}</p>`;
      }
      if (item.evidence_quote) {
        html += `<p style="margin: 4px 0; font-style: italic; color: var(--text-muted, #888);">"${item.evidence_quote}"</p>`;
      }
      html += `</div>`;
    }
  }

  // Closing
  if (evaluation.closing) {
    html += `<p style="margin-top:16px; color: var(--text-secondary, #b0b0b0);">${evaluation.closing}</p>`;
  }

  if (passRate !== undefined) {
    html += `<p style="margin-top:12px; font-weight:600;">Evidence pass rate: ${(passRate * 100).toFixed(0)}%</p>`;
  }
  html += '</div>';
  return html;
}

export function formatUploadedMetrics(metrics) {
  return `<div class="metrics-uploaded">
    <span><strong>${metrics.totalWords || 0}</strong> words</span> ·
    <span><strong>${Math.round(metrics.wordsPerMinute || 0)}</strong> WPM</span> ·
    <span><strong>${metrics.durationFormatted || "—"}</strong></span> ·
    <span><strong>${metrics.fillerWordCount || 0}</strong> fillers</span> ·
    <span><strong>${metrics.pauseCount || 0}</strong> pauses</span>
  </div>`;
}
