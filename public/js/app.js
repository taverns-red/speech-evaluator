import { S, dom, videoDom } from "./state.js";
import { SessionState, STATUS_TEXT, PROJECT_TYPES, MAX_UPLOAD_SIZE_MB, COOLDOWN_MS } from "./constants.js";
import { show, hide, enable, disable, formatTimestamp, escapeHtml } from "./utils.js";
import {
  updateUI, updateAudioLevel, handleVADStatus, checkVadEnergyFallback,
  resetVadEnergyState, updateElapsedTime, updateConsentStatusDisplay,
  updateDurationEstimateDisplay, updateProcessingIndicator, updateDeliverButtonState,
  dismissVADNotification, showError, dismissError, showSavedConfirmation,
  showInterruptionBanner, showNotification, showElapsedTime, hideElapsedTime,
} from "./ui.js";
import {
  restoreFormState, clearFormState, onConsentChange, onVideoConsentChange,
  showVideoConsentError, hideVideoConsentError, onVideoFpsChange, onVideoFpsInput,
  onTimeLimitChange, handleVADSpeechEnd, onVADConfirmStop, onVADDismiss,
  onVADConfigChange, onVADThresholdInput, onSpeechTitleChange, onProjectTypeChange,
  onObjectivesChange, resetProjectContextForm,
} from "./consent.js";

// ─── Sign Out ──────────────────────────────────────────────────────
function signOut() {
  document.cookie = "__session=;path=/;max-age=0";
  window.location.href = "/login.html?action=signout";
}

// ─── Load User Info (Issue #41) ──────────────────────────────────
function loadUserInfo() {
  fetch("/api/me")
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;

      var userInfoEl = document.getElementById("user-info");
      var avatarEl = document.getElementById("user-avatar");
      var initialsEl = document.getElementById("user-initials");
      var nameEl = document.getElementById("user-name");

      // Show display name or email
      nameEl.textContent = data.name || data.email;

      // Show avatar photo or initials fallback
      if (data.picture) {
        avatarEl.src = data.picture;
        avatarEl.style.display = "block";
        avatarEl.onerror = function () {
          avatarEl.style.display = "none";
          showInitials(initialsEl, data.name || data.email);
        };
      } else {
        showInitials(initialsEl, data.name || data.email);
      }

      userInfoEl.style.display = "flex";
    })
    .catch(function () { /* silently ignore — user info is non-critical */ });
}

function showInitials(el, nameOrEmail) {
  var parts = nameOrEmail.split(/[\s@]/);
  var initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : nameOrEmail.substring(0, 2).toUpperCase();
  el.textContent = initials;
  el.style.display = "inline-block";
}

loadUserInfo();

// ─── Meeting Roles (Phase 9, #72) ──────────────────────────────────

async function loadRoles() {
  try {
    const res = await fetch("/api/roles");
    if (!res.ok) return;
    const data = await res.json();
    if (!data.roles || data.roles.length === 0) return;

    const container = document.getElementById("role-checkboxes");
    const selector = document.getElementById("role-selector");

    for (const role of data.roles) {
      const div = document.createElement("div");
      div.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 0;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `role-${role.id}`;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          S.activeRoles.add(role.id);
        } else {
          S.activeRoles.delete(role.id);
        }
        // Send updated active roles to server via WebSocket
        wsSend({ type: "set_active_roles", roleIds: Array.from(S.activeRoles) });
      });

      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.style.cssText = "cursor:pointer; font-size:0.9em;";
      label.innerHTML = `<strong>${role.name}</strong> — ${role.description}`;

      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);
    }

    selector.style.display = "block";
  } catch (e) {
    console.warn("[Roles] Failed to load roles:", e);
  }
}
loadRoles();

// ─── Application State ────────────────────────────────────────────

// ─── Phase 2: Consent & Time Limit State ─────────────────────────

// ─── Eager Pipeline State ─────────────────────────────────────────
/** @type {string} Current pipeline stage for UI display and button gating */
/** @type {number} RunId for stale-progress filtering; 0 = accept all */

// ─── Phase 3: VAD Configuration State ─────────────────────────────
/** Whether VAD is enabled (default: true, Req 3.5) */
/** Silence threshold in seconds (default: 5, range 3-15, Req 3.1) */
/** Whether the VAD notification banner is currently visible (Req 2.2) */

// ─── Phase 3: Project Context State (Req 4.1, 4.2, 4.3, 4.4) ────
// projectContext now in S.projectContext (state.js)

// ─── Phase 4: Video Consent State (Req 1.1, 1.2, 1.5, 2.9) ──────
/** Whether video consent toggle is checked */
/** Whether camera was successfully acquired after video consent */
/** Configured video FPS (1-5, default 2) */

// PROJECT_TYPES imported from ./js/constants.js

// ─── Phase 3: VAD Audio Level Meter State (Req 10.1, 10.3, 10.4) ──
/** Timestamp (ms) of the last received vad_status message */
/** Whether to use server-side VAD energy for the audio level meter.
 *  True when S.vadEnabled AND we've received a vad_status recently (within 2s). */

// ─── TTS Audio Playback State ─────────────────────────────────────
/** @type {HTMLAudioElement|null} Audio element for TTS playback */
/** @type {string|null} Current Blob URL for TTS audio */
/** Whether TTS playback is currently active */
/** Whether the server has signaled TTS delivery is complete */
/** The last evaluation script text, used as fallback on TTS error */
/** @type {Object|null} The last StructuredEvaluationPublic object for evidence linking (Phase 3, Req 7.1) */
/** @type {number|null} Timer ID for auto-dismissing segment highlights (Phase 3, Req 7.5) */
/** Monotonic counter for playback instance identification.
 *  Incremented by handleTTSAudio (new playback) and cancelDeferredIdle (force-stop).
 *  No other code path may increment it — the latch's +1 progression check depends on this. */
/** Pending deferred IDLE transition, or null if none.
 *  Shape: { token: number } | null */
/**
 * Token-stamped latch for the "IDLE arrives before S.ttsPlaying=true" ordering edge case.
 * Shape: { tokenAtLatch: number } | null
 *
 * Set when state_change: idle arrives while in any non-IDLE state but S.ttsPlaying is false
 * (uses S.currentState !== IDLE). Stores the current S.playbackInstanceToken at latch time.
 * Idempotent: won't re-latch if already set. Does NOT fire on redundant IDLE→IDLE.
 *
 * Consumed by handleTTSAudio with token validation: only creates deferral if
 * latchToken + 1 === currentToken (expected progression); otherwise discards as stale —
 * prevents a latent latch from attaching to unrelated audio.
 *
 * Cleared by: handleTTSAudio (consumed or discarded), forceStopTtsAndCancelDeferral()
 * (force-stop paths), and transitionToIdle() (normal IDLE application).
 */

// ─── Audio Capture State ──────────────────────────────────────────
/** @type {WebSocket|null} */
/** @type {AudioContext|null} */
/** @type {AudioWorkletNode|null} */
/** @type {MediaStream|null} */
/** @type {MediaStreamAudioSourceNode|null} */
/** Whether the audio_format handshake has been sent for this connection */

// ─── Speech Recording (MediaRecorder) (#60) ──────────────────────
/** @type {MediaRecorder|null} */
/** @type {Blob[]} Collected recording chunks */
/** @type {Blob|null} Final assembled recording blob */
/** Whether we are in the post-TTS cooldown period */
/** Cooldown timer ID */
// COOLDOWN_MS imported from ./js/constants.js

// ─── DOM References ───────────────────────────────────────────────


// STATUS_TEXT imported from ./js/constants.js




// ─── UI Update: Transcript ────────────────────────────────────────
/**
 * Updates the transcript display using replaceFromIndex splice semantics.
 * The client maintains a local segment array and splices from
 * replaceFromIndex onward with the new S.segments.
 *
 * @param {Array} newSegments - Replacement suffix S.segments
 * @param {number} replaceFromIndex - Index to splice from
 */
function updateTranscript(newSegments, replaceFromIndex) {
  // Splice local segment array
  S.segments.splice(replaceFromIndex, S.segments.length - replaceFromIndex, ...newSegments);

  // Render S.segments
  renderTranscript();
}

/**
 * Renders the current S.segments array into the transcript panel.
 */
function renderTranscript() {
  if (S.segments.length === 0) {
    dom.transcriptContent.innerHTML =
      '<div class="transcript-empty">Transcript will appear here during recording...</div>';
    dom.transcriptWordCount.textContent = "";
    return;
  }

  let html = "";
  let totalWords = 0;

  for (let idx = 0; idx < S.segments.length; idx++) {
    const seg = S.segments[idx];
    const timeStr = formatTimestamp(seg.startTime);
    const cssClass = seg.isFinal ? "" : " interim";
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    totalWords += words.length;

    html += '<div class="segment' + cssClass + '" data-segment-index="' + idx + '">';
    html += '<span class="segment-time">[' + timeStr + ']</span>';
    html += escapeHtml(seg.text);
    html += "</div>";
  }

  dom.transcriptContent.innerHTML = html;
  dom.transcriptWordCount.textContent = totalWords + " words";

  // Auto-scroll to bottom
  const panelBody = dom.transcriptContent.parentElement;
  panelBody.scrollTop = panelBody.scrollHeight;
}

// ─── Phase 3: Evidence Highlight Functions (Req 7.1-7.5) ────────

/**
 * Normalizes text for evidence quote matching.
 * Matches the server-side EvidenceValidator.normalize() logic:
 *  1. Lowercase
 *  2. Strip all non-alphanumeric non-whitespace characters
 *  3. Collapse consecutive whitespace to a single space
 *  4. Trim leading/trailing whitespace
 *
 * (Req 7.3)
 * @param {string} text - The text to normalize
 * @returns {string} Normalized text
 */
function normalizeForMatch(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Finds the transcript segment that contains the given evidence quote.
 * Uses the same normalization rules as the server-side EvidenceValidator (Req 7.3).
 *
 * @param {string} quote - The evidence quote to find
 * @param {Array} segs - The transcript S.segments array
 * @returns {{segmentIndex: number, segment: Object}|null} Match result or null
 */
function findTranscriptMatch(quote, segs) {
  const normalizedQuote = normalizeForMatch(quote);
  if (normalizedQuote.length === 0) return null;

  for (let i = 0; i < segs.length; i++) {
    const segText = normalizeForMatch(segs[i].text);
    if (segText.includes(normalizedQuote)) {
      return { segmentIndex: i, segment: segs[i] };
    }
  }
  return null;
}

/**
 * Handles clicking on an evidence link in the evaluation panel.
 * Scrolls the transcript panel to the matching segment and highlights it.
 * Auto-dismisses the highlight after 3 seconds (Req 7.5).
 *
 * @param {string} quote - The evidence quote text
 */
function onEvidenceLinkClick(quote) {
  // Clear any existing highlight and timer
  clearEvidenceHighlight();

  // Find the matching segment
  var match = findTranscriptMatch(quote, S.segments);
  if (!match) return;

  // Find the segment DOM element by data-segment-index
  var segEl = dom.transcriptContent.querySelector(
    '[data-segment-index="' + match.segmentIndex + '"]'
  );
  if (!segEl) return;

  // Add highlight class
  segEl.classList.add("segment-highlight");

  // Scroll the transcript panel to the highlighted segment
  var panelBody = dom.transcriptContent.parentElement;
  segEl.scrollIntoView({ behavior: "smooth", block: "center" });

  // Make sure the transcript panel is visible
  show(dom.transcriptPanel);

  // Auto-dismiss highlight after 3 seconds (Req 7.5)
  S.highlightDismissTimer = setTimeout(function () {
    clearEvidenceHighlight();
  }, 3000);
}

/**
 * Clears any active evidence highlight from the transcript panel.
 * Cancels the auto-dismiss timer if active (Req 7.5).
 */
function clearEvidenceHighlight() {
  // Clear the timer
  if (S.highlightDismissTimer !== null) {
    clearTimeout(S.highlightDismissTimer);
    S.highlightDismissTimer = null;
  }

  // Remove highlight class from all S.segments
  var highlighted = dom.transcriptContent.querySelectorAll(".segment-highlight");
  for (var i = 0; i < highlighted.length; i++) {
    highlighted[i].classList.remove("segment-highlight");
  }
}

/**
 * Renders the evaluation text with evidence quotes as clickable links.
 * Evidence quotes from evaluation items are matched against the text
 * and wrapped in clickable <span> elements (Req 7.1).
 *
 * Redacted quotes (containing "[a fellow member]") will not match
 * transcript text and are displayed without clickable navigation (Req 7.4).
 *
 * @param {string} text - The evaluation script text
 * @param {Object|null} evaluationData - The StructuredEvaluationPublic object
 */
function renderEvaluationWithEvidence(text, evaluationData) {
  if (!text || text.trim().length === 0) {
    var emptyDiv = document.createElement("div");
    emptyDiv.className = "evaluation-empty";
    emptyDiv.textContent = "Evaluation will appear here after delivery...";
    dom.evaluationContent.textContent = "";
    dom.evaluationContent.appendChild(emptyDiv);
    return;
  }

  // If no evaluation data with items, fall back to plain text rendering
  if (!evaluationData || !evaluationData.items || evaluationData.items.length === 0) {
    var plainDiv = document.createElement("div");
    plainDiv.textContent = text;
    dom.evaluationContent.textContent = "";
    dom.evaluationContent.appendChild(plainDiv);
    return;
  }

  // Build a list of evidence quotes with their match status.
  // Matching is done on the raw (unescaped) text.
  var evidenceQuotes = [];
  for (var i = 0; i < evaluationData.items.length; i++) {
    var item = evaluationData.items[i];
    if (item.evidence_quote && item.evidence_quote.trim().length > 0) {
      var match = findTranscriptMatch(item.evidence_quote, S.segments);
      evidenceQuotes.push({
        quote: item.evidence_quote,
        timestamp: item.evidence_timestamp,
        hasMatch: match !== null
      });
    }
  }

  // Sort evidence quotes by length descending to avoid partial replacement issues
  // (longer quotes should be replaced first)
  evidenceQuotes.sort(function (a, b) {
    return b.quote.length - a.quote.length;
  });

  // Find evidence quote positions in the raw text, tracking occupied ranges
  // to prevent overlapping replacements
  var quotePositions = []; // { start, end, quoteIndex }
  var occupiedRanges = [];

  for (var q = 0; q < evidenceQuotes.length; q++) {
    var ev = evidenceQuotes[q];
    var searchStart = 0;
    var foundIndex = -1;

    while (searchStart < text.length) {
      var idx = text.indexOf(ev.quote, searchStart);
      if (idx === -1) break;

      // Check overlap with occupied ranges
      var overlaps = false;
      for (var r = 0; r < occupiedRanges.length; r++) {
        if (idx < occupiedRanges[r].end && idx + ev.quote.length > occupiedRanges[r].start) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        foundIndex = idx;
        break;
      }
      searchStart = idx + 1;
    }

    if (foundIndex === -1) continue;

    quotePositions.push({ start: foundIndex, end: foundIndex + ev.quote.length, quoteIndex: q });
    occupiedRanges.push({ start: foundIndex, end: foundIndex + ev.quote.length });
  }

  // Sort positions by start offset for left-to-right DOM assembly
  quotePositions.sort(function (a, b) { return a.start - b.start; });

  // Build DOM: interleave text nodes with evidence span elements
  var container = document.createElement("div");
  var cursor = 0;

  for (var p = 0; p < quotePositions.length; p++) {
    var pos = quotePositions[p];
    var evData = evidenceQuotes[pos.quoteIndex];

    // Text before this quote
    if (pos.start > cursor) {
      container.appendChild(document.createTextNode(text.substring(cursor, pos.start)));
    }

    // Evidence span (created via DOM — no innerHTML)
    var span = document.createElement("span");
    span.textContent = evData.quote;

    if (evData.hasMatch) {
      // Clickable evidence link (Req 7.1)
      span.className = "evidence-link";
      span.dataset.quote = evData.quote;
      span.dataset.timestamp = evData.timestamp;
      span.title = "Click to navigate to transcript";
      span.addEventListener("click", (function (quote) {
        return function () { onEvidenceLinkClick(quote); };
      })(evData.quote));
    } else {
      // No match — display without clickable navigation (Req 7.4)
      span.className = "evidence-no-match";
    }

    container.appendChild(span);
    cursor = pos.end;
  }

  // Remaining text after the last quote
  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.substring(cursor)));
  }

  dom.evaluationContent.textContent = "";
  dom.evaluationContent.appendChild(container);
}

// ─── UI Update: Evaluation ────────────────────────────────────────
/**
 * Displays the evaluation text in the evaluation panel.
 * Used both for normal display and as TTS fallback.
 * When evaluation data with evidence items is available,
 * renders evidence quotes as clickable links (Phase 3, Req 7.1).
 *
 * @param {string} text - The evaluation script text
 */
function showEvaluation(text) {
  S.hasEvaluationData = true;

  if (!text || text.trim().length === 0) {
    dom.evaluationContent.innerHTML =
      '<div class="evaluation-empty">Evaluation will appear here after delivery...</div>';
    return;
  }

  // Use evidence-aware rendering when evaluation data is available
  renderEvaluationWithEvidence(text, S.lastEvaluationData);
  show(dom.evaluationPanel);
}

// ─── UI Update: Role Results Display ─────────────────────────────
/**
 * Displays meeting role results (e.g., Ah-Counter report) in a
 * dedicated panel below the evaluation.
 */
function displayRoleResults(results) {
  if (!results || results.length === 0) return;

  // Find or create the role results container
  let container = document.getElementById("role-results-panel");
  if (!container) {
    container = document.createElement("div");
    container.id = "role-results-panel";
    container.style.cssText = "margin-top: 24px;";
    // Insert after evaluation panel
    const evalPanel = document.getElementById("evaluation-panel");
    if (evalPanel && evalPanel.parentNode) {
      evalPanel.parentNode.insertBefore(container, evalPanel.nextSibling);
    } else {
      document.querySelector(".main-content")?.appendChild(container);
    }
  }

  container.innerHTML = "";

  for (const role of results) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "margin-bottom: 16px; padding: 20px; border-left: 3px solid var(--red-primary, #e53935);";

    let html = `<h3 style="margin: 0 0 12px; color: var(--text-primary);">${escapeHtml(role.report.title)}</h3>`;

    for (const section of role.report.sections) {
      html += `<h4 style="margin: 12px 0 6px; color: var(--text-secondary); font-size: 0.9em; text-transform: uppercase;">${escapeHtml(section.heading)}</h4>`;
      html += `<p style="margin: 0 0 8px; color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(section.content)}</p>`;
    }

    card.innerHTML = html;
    container.appendChild(card);
  }

  container.style.display = "block";
  showNotification(`${results.length} meeting role report(s) ready`, "success");
}




// ─── WebSocket Connection ─────────────────────────────────────────

// Reconnect state
let reconnectDelay = 1000; // Start at 1s, exponential backoff up to 30s
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_DELAY_INITIAL = 1000;
let reconnectTimer = null;
const btnReconnect = document.getElementById("btn-reconnect");

/**
 * Establishes a WebSocket connection to the server.
 * Handles connection lifecycle, auto-reconnection with exponential backoff,
 * and message routing.
 */
// Track whether a live session is active (for reconnect decisions)

function connectWebSocket() {
  if (S.ws && (S.ws.readyState === WebSocket.OPEN || S.ws.readyState === WebSocket.CONNECTING)) {
    return; // Already connected or connecting
  }

  // Clear any pending reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = protocol + "//" + window.location.host;

  dom.connectionStatus.textContent = "Connecting…";
  dom.connectionStatus.style.color = "var(--text-muted)";
  btnReconnect.style.display = "none";

  S.ws = new WebSocket(url);
  S.audioFormatSent = false;
  // Per Hazard 2: reset S.pipelineRunId on reconnect to prevent stale filtering
  S.pipelineRunId = 0;

  S.ws.binaryType = "arraybuffer"; // For receiving TTS audio

  S.ws.onopen = function () {
    dom.connectionStatus.textContent = "Connected";
    dom.connectionStatus.style.color = "var(--color-success)";
    btnReconnect.style.display = "none";
    // Reset backoff on successful connection
    reconnectDelay = RECONNECT_DELAY_INITIAL;
    // Send audio format handshake immediately on connection
    sendAudioFormatHandshake();
  };

  S.ws.onmessage = function (event) {
    if (event.data instanceof ArrayBuffer) {
      // Binary message — TTS audio chunk
      console.log("[WS] Received binary frame:", event.data.byteLength, "bytes");
      handleTTSAudio(event.data);
      return;
    }
    try {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    } catch (err) {
      console.error("Failed to parse server message:", err);
    }
  };

  S.ws.onclose = function () {
    // Fail-safe: if WS drops during playback, deferred state, pending latch,
    // or any non-IDLE state, stop everything.
    if (S.ttsPlaying || S.deferredIdleTransition !== null || S.pendingIdleFromServer !== null || S.currentState !== SessionState.IDLE) {
      triggerTTSFailSafe();
    }

    S.ws = null;
    S.audioFormatSent = false;

    // Only auto-reconnect during active live sessions — not idle page views
    if (S.liveSessionActive) {
      const delaySec = (reconnectDelay / 1000).toFixed(0);
      dom.connectionStatus.textContent = `Reconnecting in ${delaySec}s…`;
      dom.connectionStatus.style.color = "var(--color-warning, #e6a817)";
      btnReconnect.style.display = "inline-block";

      console.log(`[WS] Disconnected during session. Auto-reconnecting in ${delaySec}s…`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
      }, reconnectDelay);

      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_DELAY_MAX);
    } else {
      dom.connectionStatus.textContent = "Disconnected";
      dom.connectionStatus.style.color = "var(--text-muted)";
      console.log("[WS] Disconnected (no active session — not auto-reconnecting)");
    }
  };

  S.ws.onerror = function (err) {
    console.error("WebSocket error:", err);
    dom.connectionStatus.textContent = "Connection Error";
    dom.connectionStatus.style.color = "var(--color-danger)";
  };
}

/**
 * Connects the WebSocket and returns a promise that resolves when
 * the connection is open. Used by onStartSpeech() for on-demand connection.
 * Rejects after 10 seconds if the connection cannot be established.
 */
function connectWebSocketAndWait() {
  return new Promise((resolve, reject) => {
    if (S.ws && S.ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    connectWebSocket();
    const timeout = setTimeout(() => {
      reject(new Error("WebSocket connection timeout"));
    }, 10000);
    const checkInterval = setInterval(() => {
      if (S.ws && S.ws.readyState === WebSocket.OPEN) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve();
      } else if (!S.ws || S.ws.readyState === WebSocket.CLOSED) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        reject(new Error("WebSocket connection failed"));
      }
    }, 50);
  });
}

/**
 * Manually trigger reconnection (e.g., from the Reconnect button).
 * Resets backoff delay for immediate retry.
 */
function manualReconnect() {
  reconnectDelay = RECONNECT_DELAY_INITIAL;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connectWebSocket();
}
// Expose for the onclick handler on the button
window.__reconnectWS = manualReconnect;

/**
 * Sends a JSON message to the server via WebSocket.
 * @param {Object} message - The message object to send
 */
export function wsSend(message) {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) {
    S.ws.send(JSON.stringify(message));
  } else {
    showError("Not connected to server. Reconnecting…", false);
    dom.connectionStatus.textContent = "Disconnected";
    dom.connectionStatus.style.color = "var(--text-muted)";
    manualReconnect();
  }
}

/**
 * Sends the audio_format handshake message.
 * Must be sent before start_recording per the protocol contract.
 */
function sendAudioFormatHandshake() {
  wsSend({
    type: "audio_format",
    channels: 1,
    sampleRate: 16000,
    encoding: "LINEAR16",
  });
  S.audioFormatSent = true;
}

// ─── Server Message Handler ───────────────────────────────────────

/**
 * Routes incoming server messages to the appropriate handler.
 * @param {Object} message - Parsed ServerMessage
 */
function handleServerMessage(message) {
  switch (message.type) {
    case "state_change":
      handleStateChange(message.state);
      break;
    case "transcript_update":
      updateTranscript(message.segments, message.replaceFromIndex);
      break;
    case "elapsed_time":
      updateElapsedTime(message.seconds);
      break;
    case "evaluation_ready":
      S.lastEvaluationScript = message.script || "";
      S.lastEvaluationData = message.evaluation || null;
      showEvaluation(message.script);
      break;
    case "role_results":
      displayRoleResults(message.results);
      break;
    case "tts_complete":
      handleTTSComplete();
      break;
    case "outputs_saved":
      showSavedConfirmation(message.paths, message.files);
      break;
    case "error":
      // Fail-safe silent mode: if error occurs during TTS delivery,
      // stop playback and show written evaluation as fallback (Req 7.4)
      if (S.currentState === SessionState.DELIVERING) {
        triggerTTSFailSafe();
      } else {
        showError(message.message, message.recoverable);
      }
      break;
    case "audio_format_error":
      // Audio format errors are always non-recoverable; stop capture
      if (S.currentState === SessionState.DELIVERING) {
        triggerTTSFailSafe();
      } else {
        showError("Audio format error: " + message.message, false);
        stopAudioCapture();
      }
      break;
    case "consent_status":
      handleConsentStatus(message.consent);
      break;
    case "duration_estimate":
      handleDurationEstimate(message.estimatedSeconds, message.timeLimitSeconds);
      break;
    case "data_purged":
      handleDataPurged(message.reason);
      break;
    case "pipeline_progress":
      // Ignore stale progress from cancelled pipelines (Hazard 2, Hazard 5)
      if (message.runId < S.pipelineRunId) break;
      S.pipelineRunId = message.runId;
      S.pipelineStage = message.stage;
      updateProcessingIndicator(message.stage);
      updateDeliverButtonState(message.stage);
      break;
    case "vad_speech_end":
      handleVADSpeechEnd(message);
      break;
    case "vad_status":
      handleVADStatus(message);
      break;
    case "video_status":
      // Phase 4: Handle video processing status updates (Req 10.8)
      handleVideoStatus(message);
      break;
    default:
      console.warn("Unknown server message type:", message.type);
  }
}

/**
 * Handles state_change messages from the server.
 * Updates UI and manages audio capture lifecycle based on state transitions.
 * @param {string} newState - The new SessionState
 */
function handleStateChange(newState) {
  const previousState = S.currentState;

  // Phase 4: Stop video frame capture when leaving RECORDING state (Req 2.1, 2.2)
  // This handles server-initiated transitions (auto-stop, errors) in addition to
  // the explicit stopVideoCapture() calls in onStopSpeech() and onPanicMute().
  if (previousState === SessionState.RECORDING && newState !== SessionState.RECORDING) {
    stopVideoCapture();
  }

  // Echo prevention: hard-stop mic when entering DELIVERING state
  if (newState === SessionState.DELIVERING) {
    hardStopMic();
  }

  // If leaving DELIVERING due to panic mute (going to IDLE without tts_complete),
  // force-stop playback. But if S.ttsDeliveryComplete is true, let audio play naturally.
  if (previousState === SessionState.DELIVERING && newState !== SessionState.DELIVERING) {
    if (!S.ttsDeliveryComplete) {
      // Panic mute or error — force stop
      console.log("[TTS] Forced stop: leaving DELIVERING without tts_complete");
      forceStopTtsAndCancelDeferral(); // Clears deferral, bumps token, stops audio, clears S.ttsPlaying
    }
    // If S.ttsDeliveryComplete is true, audio is playing or finished — don't interrupt
  }

  // ── IDLE transition decision chain (explicit else-if to prevent reorder mistakes) ──
  // Branch A: S.ttsPlaying is true → defer
  if (newState === SessionState.IDLE && S.ttsPlaying) {
    if (!S.ttsAudioElement || !S.ttsAudioElement.src) {
      console.warn("[TTS] S.ttsPlaying is true but audio element/src missing — possible bug");
    }
    // Idempotent: don't overwrite an existing deferral
    if (S.deferredIdleTransition === null) {
      S.deferredIdleTransition = { token: S.playbackInstanceToken };
    }
    // Cooldown will start when deferred IDLE is applied
    return; // Do NOT call updateUI yet
  }

  // Branch B: not playing, non-IDLE state → latch (IDLE arrived before audio)
  // Token-stamped: store current S.playbackInstanceToken so handleTTSAudio can
  // verify the latch is from the expected session phase (new token = latch + 1).
  // If handleTTSAudio never runs (e.g., server error, no audio sent), the latch
  // is harmless — transitionToIdle() clears it, and force-stop paths clear it too.
  else if (newState === SessionState.IDLE && !S.ttsPlaying && S.currentState !== SessionState.IDLE) {
    if (S.pendingIdleFromServer === null) {
      S.pendingIdleFromServer = { tokenAtLatch: S.playbackInstanceToken };
    }
    // Don't transition yet — wait for handleTTSAudio to consume the latch
    return;
  }

  // Branch C: not playing, already IDLE or no latch needed → immediate transition
  // All non-deferred IDLE transitions go through transitionToIdle() — single unified path.
  else if (newState === SessionState.IDLE) {
    transitionToIdle();
    return;
  }

  // Branch D: non-IDLE state → pass through
  updateUI(newState);
}

/**
 * Handles incoming TTS audio data (binary WebSocket frames).
 * Creates a Blob URL and plays via HTMLAudioElement for cross-browser
 * compatibility (Safari has issues with Web Audio API decodeAudioData
 * on certain MP3 encodings).
 * @param {ArrayBuffer} audioData - Raw audio bytes from TTS
 */

/**
 * Primes the TTS audio element during a user gesture so the browser
 * grants playback permission. Called from click handlers before the
 * async WebSocket round-trip that delivers the actual audio data.
 *
 * Two-pronged unlock:
 * 1. Resume a shared AudioContext (unlocks Web Audio for the page).
 * 2. Create the Audio element and call play() with an empty src —
 *    even though it fails, the element is now "user-activated" and
 *    subsequent play() calls with real data will succeed.
 */
function primeTTSAudioElement() {
  cleanupTTSAudio();

  // Unlock the page-level audio policy via AudioContext
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(function () {
      ctx.close();
    });
  } catch (e) {
    // AudioContext not available — rely on element priming alone
  }

  // Create the element within the user gesture scope
  S.ttsAudioElement = new Audio();
  S.ttsAudioElement.preload = "auto";
}

function handleTTSAudio(audioData) {
  S.hasTTSAudio = true;
  S.ttsDeliveryComplete = false;
  if (!audioData || audioData.byteLength === 0) {
    console.warn("[TTS] Received empty audio data, ignoring");
    return;
  }

  console.log("[TTS] Received audio chunk:", audioData.byteLength, "bytes");

  // Create a Blob URL from the audio data
  if (S.ttsBlobUrl) {
    URL.revokeObjectURL(S.ttsBlobUrl);
  }
  const blob = new Blob([audioData], { type: "audio/mpeg" });
  S.ttsBlobUrl = URL.createObjectURL(blob);

  // Reuse the primed element if available, otherwise create a new one
  if (!S.ttsAudioElement) {
    S.ttsAudioElement = new Audio();
    S.ttsAudioElement.preload = "auto";
  }

  // ── MUST-NOT-REFACTOR ORDERING INVARIANT ──
  // The following steps MUST execute in exactly this order. Reordering any
  // step (especially moving latch consumption after play() or after setting
  // S.ttsPlaying) can reintroduce the race condition this fix exists to prevent.
  //
  // Explicit ordering: token++ → capture → consume latch → set handlers → S.ttsPlaying=true → play()

  // 1. Increment token for this new playback instance
  S.playbackInstanceToken++;
  // 2. Capture token for closure
  const currentToken = S.playbackInstanceToken;

  // 3. Consume the S.pendingIdleFromServer latch: if IDLE arrived before this
  // function ran (ordering edge case), create the deferral now, bound to the
  // new token. Token validation: only consume if the latch token matches
  // expected progression (latchToken + 1 === currentToken). This prevents a
  // stale latch from an earlier session phase from "attaching" to unrelated
  // audio (e.g., replay triggered much later after other state changes).
  // If the token doesn't match, the latch is stale — discard it.
  if (S.pendingIdleFromServer !== null) {
    var latchIsRelevant = (S.pendingIdleFromServer.tokenAtLatch + 1 === currentToken);
    S.pendingIdleFromServer = null; // Always clear — consumed or discarded
    if (latchIsRelevant && S.deferredIdleTransition === null) {
      S.deferredIdleTransition = { token: currentToken };
    }
  }

  // 3b. Adopt existing deferral: if a S.deferredIdleTransition was created for
  // a previous playback (e.g., IDLE arrived during playback N, creating deferral
  // with token N, then new audio arrives bumping token to N+1), update the
  // deferral token to the current playback. Without this, the new onended
  // (token N+1) would never match the old deferral (token N), leaving a dead
  // deferral that prevents IDLE transition.
  if (S.deferredIdleTransition !== null && S.deferredIdleTransition.token !== currentToken) {
    S.deferredIdleTransition = { token: currentToken };
  }

  // 4. Set handlers BEFORE play() so they're ready for immediate events
  S.ttsAudioElement.onplay = function () {
    console.log("[TTS] Audio playback started");
  };

  S.ttsAudioElement.onended = function () {
    console.log("[TTS] Audio playback ended naturally");
    // Clean up state FIRST so updateUI sees consistent flags
    S.ttsPlaying = false;
    cleanupTTSAudio();
    // Then apply deferred IDLE (which calls updateUI via transitionToIdle)
    applyDeferredIdle(currentToken);
  };

  S.ttsAudioElement.onerror = function (e) {
    console.error("[TTS] Audio element error:", S.ttsAudioElement ? S.ttsAudioElement.error : e);
    // onerror: triggerTTSFailSafe owns the force-stop internally
    triggerTTSFailSafe();
  };

  // 5. Set S.ttsPlaying=true immediately before play() — covers the decode gap
  S.ttsPlaying = true;

  // 6. Swap in the real audio source and play
  S.ttsAudioElement.src = S.ttsBlobUrl;
  S.ttsAudioElement.play().then(function () {
    console.log("[TTS] play() promise resolved, audio is playing");
  }).catch(function (err) {
    console.error("[TTS] play() promise rejected:", err);
    // play() can reject without firing onerror — triggerTTSFailSafe owns the force-stop
    triggerTTSFailSafe();
  });
}

/**
 * Cleans up TTS audio resources (element and Blob URL).
 */
function cleanupTTSAudio() {
  if (S.ttsAudioElement) {
    S.ttsAudioElement.onplay = null;
    S.ttsAudioElement.onended = null;
    S.ttsAudioElement.onerror = null;
    S.ttsAudioElement.pause();
    S.ttsAudioElement.src = "";
    S.ttsAudioElement = null;
  }
  if (S.ttsBlobUrl) {
    URL.revokeObjectURL(S.ttsBlobUrl);
    S.ttsBlobUrl = null;
  }
}

/**
 * Stops all TTS audio playback and cleans up resources.
 * Nulls out event handlers BEFORE pausing to prevent lingering handlers
 * from firing on reused elements and to reduce reentrancy risk.
 */
function stopTTSPlayback() {
  // Null out event handlers first — prevents onended/onerror from firing
  // during pause/cleanup, which could cause reentrancy issues
  if (S.ttsAudioElement) {
    S.ttsAudioElement.onended = null;
    S.ttsAudioElement.onerror = null;
    S.ttsAudioElement.onplay = null;
  }
  cleanupTTSAudio();
  S.ttsPlaying = false;
  S.ttsDeliveryComplete = false;
}

/**
 * Applies a deferred IDLE transition if the token matches.
 * Called from onended handler after S.ttsPlaying and cleanup are done.
 *
 * No-op cases (both are safe and expected):
 * - S.deferredIdleTransition is null (no deferral was pending — e.g., audio ended
 *   before state_change: idle arrived, or deferral was already cancelled)
 * - Token mismatch (stale onended from a previous/cancelled playback)
 *
 * Clears S.deferredIdleTransition BEFORE calling transitionToIdle() — this ordering
 * prevents reentrancy (e.g., duplicate onended) from re-running transitionToIdle().
 *
 * @param {number} token - The playback instance token from the onended closure
 */
function applyDeferredIdle(token) {
  if (S.deferredIdleTransition === null) return; // No deferral pending — no-op
  if (S.deferredIdleTransition.token !== token) return; // Stale event — ignore

  S.deferredIdleTransition = null;
  transitionToIdle();
}

/**
 * Single authoritative function for transitioning to IDLE with cooldown.
 * ALL code paths that transition to IDLE must go through this function —
 * including triggerTTSFailSafe(), applyDeferredIdle(), and handleStateChange().
 * This prevents double-cooldown, missing-cooldown, and micro-hiccup bugs.
 *
 * Order: clear S.pendingIdleFromServer first, then updateUI (pure visual state flip),
 * then startCooldown (timers/side effects). This prevents micro-hiccups from
 * cooldown DOM/timer work before the UI state is consistent.
 *
 * Idempotency guard: S.currentState === SessionState.IDLE && S.cooldownTimer !== null
 * — precise enough to distinguish "IDLE with cooldown active" (no-op) from
 * "IDLE without cooldown" (needs cooldown start, e.g., recovery paths).
 * Using just S.currentState === IDLE would skip cooldown in legitimate cases.
 */
function transitionToIdle() {
  // Precise idempotency: skip only if already IDLE AND cooldown is running.
  // If IDLE but no cooldown (recovery path), we still need to start cooldown.
  if (S.currentState === SessionState.IDLE && S.cooldownTimer !== null) return;
  S.pendingIdleFromServer = null; // Clear latch — we're applying IDLE now
  updateUI(SessionState.IDLE);
  startCooldown();
}

/**
 * Cancels any pending deferred IDLE transition and invalidates the current
 * playback token so that late onended events from a previous playback
 * cannot apply a future deferral.
 *
 * DOES NOT clear S.ttsPlaying or stop playback — that is the responsibility
 * of stopTTSPlayback(). DOES NOT clear S.pendingIdleFromServer — that is
 * cleared by forceStopTtsAndCancelDeferral() or transitionToIdle().
 * Use forceStopTtsAndCancelDeferral() for force-stop paths.
 *
 * Called internally by forceStopTtsAndCancelDeferral().
 */
function cancelDeferredIdle() {
  S.deferredIdleTransition = null;
  // Monotonic bump: any in-flight onended closure holding the old token
  // will fail the token match in applyDeferredIdle()
  S.playbackInstanceToken++;
}

/**
 * Composite force-stop: cancels deferral, bumps token, clears latch, stops audio,
 * clears S.ttsPlaying.
 *
 * Post-conditions hold immediately after the call:
 * - S.deferredIdleTransition === null
 * - S.pendingIdleFromServer === null
 * - S.playbackInstanceToken bumped (late onended events are harmless due to token
 *   invalidation + handler nulling in stopTTSPlayback)
 * - S.ttsPlaying === false
 * - audio element event handlers nulled
 *
 * Note: this is NOT truly atomic against queued browser events — a late onended
 * CAN still fire after this call returns. That is safe because the token bump +
 * handler nulling ensures late callbacks are no-ops. Do not assume "no late
 * callbacks possible"; assume "late callbacks are harmless."
 *
 * ALL force-stop paths (panic mute, revoke consent, S.ws close, onerror, play reject)
 * MUST call this instead of calling cancelDeferredIdle() and stopTTSPlayback() separately.
 */
function forceStopTtsAndCancelDeferral() {
  cancelDeferredIdle();          // Clear deferral + bump token
  S.pendingIdleFromServer = null;  // Clear latch
  stopTTSPlayback();             // Stop audio + clear S.ttsPlaying + null handlers
}

/**
 * Fail-safe silent mode: stops TTS playback, shows written evaluation
 * as fallback, and transitions UI to IDLE. No automatic retry.
 * Per meeting-safety-controls.md: if any critical error occurs during
 * TTS delivery, playback stops immediately and the written evaluation
 * is displayed as fallback.
 *
 * Contract: calls forceStopTtsAndCancelDeferral() internally (idempotent if
 * already stopped), shows written evaluation panel, then calls transitionToIdle().
 * Callers never need to force-stop before calling this — single entry point,
 * no double-stop/double-cooldown risk.
 */
function triggerTTSFailSafe() {
  forceStopTtsAndCancelDeferral();

  // Show the written evaluation as fallback (Requirement 7.4)
  if (S.lastEvaluationScript) {
    showEvaluation(S.lastEvaluationScript);
  }
  show(dom.evaluationPanel);

  // Show a non-recoverable error explaining the fallback
  showError("Audio playback failed. The written evaluation is displayed below.", false);

  // Transition UI to IDLE via single authoritative path
  transitionToIdle();
}

/**
 * Handles tts_complete message — TTS delivery finished on the server side.
 * Does NOT stop playback — the audio may still be playing.
 * Sets a flag so the client knows no more chunks are coming.
 */
function handleTTSComplete() {
  console.log("[TTS] Server signaled tts_complete, audio may still be playing");
  S.ttsDeliveryComplete = true;
}

// ─── Phase 2: Consent, Duration, and Purge Handlers ──────────────

/**
 * Handles consent_status message from the server.
 * Updates local consent state and UI.
 * @param {Object|null} consent - ConsentRecord or null
 */
function handleConsentStatus(consent) {
  if (consent) {
    S.consentSpeakerName = consent.speakerName || "";
    S.consentConfirmed = consent.consentConfirmed || false;
    // Sync form inputs with server state
    dom.speakerNameInput.value = S.consentSpeakerName;
    dom.consentCheckbox.checked = S.consentConfirmed;
  } else {
    S.consentSpeakerName = "";
    S.consentConfirmed = false;
    dom.speakerNameInput.value = "";
    dom.consentCheckbox.checked = false;
  }
  updateUI(S.currentState);
}

/**
 * Handles duration_estimate message from the server.
 * Updates the duration estimate display.
 * @param {number} estimatedSeconds - Estimated evaluation duration
 * @param {number} timeLimitSeconds - Configured time limit
 */
function handleDurationEstimate(estimatedSeconds, timeLimitSeconds) {
  S.estimatedDuration = estimatedSeconds;
  S.configuredTimeLimit = timeLimitSeconds;
  dom.timeLimitInput.value = timeLimitSeconds;
  updateDurationEstimateDisplay(estimatedSeconds, timeLimitSeconds);
  // Show the estimate if we're in PROCESSING state
  if (S.currentState === SessionState.PROCESSING) {
    show(dom.durationEstimate);
  }
}

/**
 * Handles data_purged message from the server.
 * Clears all displayed data and updates UI based on purge reason.
 * @param {string} reason - "opt_out" or "auto_purge"
 */
function handleDataPurged(reason) {
  // Clear all displayed data
  S.segments = [];
  renderTranscript();
  dom.evaluationContent.innerHTML =
    '<div class="evaluation-empty">Evaluation will appear here after delivery...</div>';
  hide(dom.evaluationPanel);
  hide(dom.transcriptPanel);
  S.hasEvaluationData = false;
  S.hasTTSAudio = false;
  S.lastEvaluationScript = "";
  S.lastEvaluationData = null;
  S.lastVideoQualityGrade = null;
  S.estimatedDuration = null;
  hide(dom.durationEstimate);
  forceStopTtsAndCancelDeferral();
  // Reset pipeline state on data purge (Req 6.3)
  S.pipelineStage = "idle";
  S.pipelineRunId = 0;
  // Clear evidence highlights (Phase 3)
  clearEvidenceHighlight();
  // Hide video quality grade badge
  if (videoDom.qualityGrade) {
    videoDom.qualityGrade.className = "video-quality-grade";
  }

  if (reason === "opt_out") {
    // Permanent purge — disable Save Outputs for this session
    S.dataPurged = true;
    // Reset consent form
    S.consentSpeakerName = "";
    S.consentConfirmed = false;
    dom.speakerNameInput.value = "";
    dom.consentCheckbox.checked = false;
    // Clear persisted form state on consent revocation (#58)
    clearFormState();
    S.videoConsentEnabled = false;
    S.videoStreamReady = false;
    dom.videoConsentCheckbox.checked = false;
    disable(dom.videoConsentCheckbox);
    hideVideoConsentError();
    releaseCamera();
    // Reset video FPS config to default
    S.videoFpsConfig = 2;
    dom.videoFpsSlider.value = 2;
    dom.videoFpsValue.textContent = "2 FPS";
    // Reset VAD config to defaults (Phase 3, Req 3.1, 3.5)
    S.vadEnabled = true;
    S.vadSilenceThreshold = 5;
    dom.vadEnabledCheckbox.checked = true;
    dom.vadThresholdSlider.value = 5;
    dom.vadThresholdValue.textContent = "5s";
    resetVadEnergyState();
    // Reset project context form (Phase 3, Req 4.1)
    resetProjectContextForm();
    // Show opt-out purge banner
    dom.purgeMessage.textContent = "Speaker data has been purged per opt-out request.";
    dom.purgeBanner.className = "purge-banner visible opt-out";
  } else if (reason === "auto_purge") {
    // Auto-purge — informational
    // Reset video consent (Phase 4)
    S.videoConsentEnabled = false;
    S.videoStreamReady = false;
    dom.videoConsentCheckbox.checked = false;
    disable(dom.videoConsentCheckbox);
    hideVideoConsentError();
    releaseCamera();
    // Reset video FPS config to default
    S.videoFpsConfig = 2;
    dom.videoFpsSlider.value = 2;
    dom.videoFpsValue.textContent = "2 FPS";
    // Reset VAD config to defaults (Phase 3)
    S.vadEnabled = true;
    S.vadSilenceThreshold = 5;
    dom.vadEnabledCheckbox.checked = true;
    dom.vadThresholdSlider.value = 5;
    dom.vadThresholdValue.textContent = "5s";
    resetVadEnergyState();
    // Reset project context form (Phase 3)
    resetProjectContextForm();
    dom.purgeMessage.textContent = "Session data auto-purged after timeout.";
    dom.purgeBanner.className = "purge-banner visible auto-purge";
  }

  // Transition to IDLE via single authoritative path
  transitionToIdle();
}

// ─── Audio Capture: Mic + AudioWorklet ────────────────────────────

/**
 * Requests microphone permission and checks for available audio input devices.
 * @returns {Promise<boolean>} true if mic is available and permission granted
 */
async function checkMicPermission() {
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
async function startAudioCapture() {
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
    await S.audioContext.audioWorklet.addModule("audio-worklet.js");

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
function stopAudioCapture() {
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
function hardStopMic() {
  // Stop the AudioWorklet first
  stopAudioCapture();

  // Phase 4: Stop video frame capture (echo prevention — no video during delivery)
  stopVideoCapture();

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
function startCooldown() {
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
function clearCooldown() {
  if (S.cooldownTimer) {
    clearTimeout(S.cooldownTimer);
    S.cooldownTimer = null;
  }
  S.inCooldown = false;
}

// ─── Button Click Handlers ────────────────────────────────────────

function toggleVideoSize() {
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


// ─── Upload Flow ──────────────────────────────────────────────────────

// ─── Form file state ──────────────────────────────────────────────

function onFileSelected(event) {
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

function onFormFileSelected(event) {
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

function startUploadTimer() {
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

function stopUploadTimer() {
  if (S.uploadElapsedInterval) { clearInterval(S.uploadElapsedInterval); S.uploadElapsedInterval = null; }
  S.activeUploadXHR = null;
}

function computeSpeedAndETA(loaded, total) {
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

function updateUploadProgress(stage, progress, message) {
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

function updatePipelineSteps(stage) {
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

function showUploadThumbnail(file) {
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

function hideUploadThumbnail() {
  document.getElementById("upload-thumbnail-container").style.display = "none";
  if (thumbnailObjectUrl) { URL.revokeObjectURL(thumbnailObjectUrl); thumbnailObjectUrl = null; }
}

function updateSpeedETA(speed, eta) {
  const el = document.getElementById("upload-speed-eta");
  const parts = [];
  if (speed) parts.push(speed);
  if (eta) parts.push(eta);
  el.textContent = parts.join(" — ");
}

function hideUploadProgress() {
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
async function uploadViaGCS(file, metadata) {
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
async function uploadLegacy(file, metadata) {
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

async function uploadVideo(file) {
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

function formatUploadedEvaluation(evaluation, metrics, passRate) {
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

function formatUploadedMetrics(metrics) {
  return `<div class="metrics-uploaded">
    <span><strong>${metrics.totalWords || 0}</strong> words</span> ·
    <span><strong>${Math.round(metrics.wordsPerMinute || 0)}</strong> WPM</span> ·
    <span><strong>${metrics.durationFormatted || "—"}</strong></span> ·
    <span><strong>${metrics.fillerWordCount || 0}</strong> fillers</span> ·
    <span><strong>${metrics.pauseCount || 0}</strong> pauses</span>
  </div>`;
}

async function onStartSpeech() {
  // Guard: immediately disable to prevent double-click (#29)
  disable(dom.btnStart);

  // Guard: don't start during cooldown
  if (S.inCooldown) { enable(dom.btnStart); return; }

  // Guard: consent must be confirmed (Req 2.3)
  if (!S.consentConfirmed || S.consentSpeakerName.trim().length === 0) {
    showError("Please enter the speaker's name and confirm consent before starting.", true);
    enable(dom.btnStart);
    return;
  }

  // Connect WebSocket on demand (deferred from page load per #59)
  S.liveSessionActive = true;
  try {
    await connectWebSocketAndWait();
  } catch (err) {
    showError("Could not connect to server. Please try again.", true);
    S.liveSessionActive = false;
    enable(dom.btnStart);
    return;
  }

  // Reset state for new recording
  S.segments = [];
  S.hasEvaluationData = false;
  S.hasTTSAudio = false;
  S.outputsSaved = false;
  S.dataPurged = false;
  S.estimatedDuration = null;
  S.lastEvaluationScript = "";
  S.lastEvaluationData = null;
  // Reset pipeline state for new recording (Req 2.5, 6.3)
  S.pipelineStage = "idle";
  S.pipelineRunId = 0;
  forceStopTtsAndCancelDeferral();
  dismissError();
  hideVideoConsentError();
  clearEvidenceHighlight();
  hide(dom.interruptionBanner);
  hide(dom.savedConfirmation);
  hide(dom.purgeBanner);
  hide(dom.durationEstimate);
  dom.evaluationContent.innerHTML =
    '<div class="evaluation-empty">Evaluation will appear here after delivery...</div>';
  hide(dom.evaluationPanel);

  // Ensure audio format handshake was sent
  if (!S.audioFormatSent) {
    sendAudioFormatHandshake();
  }

  // Start audio capture (mic + AudioWorklet)
  const captureStarted = await startAudioCapture();
  if (!captureStarted) {
    return; // Error already shown by startAudioCapture
  }

  // Phase 4: Camera is already acquired via video consent toggle (Req 1.5)
  // Only start video capture if video consent is enabled and camera is ready

  // Send start_recording command to server
  wsSend({ type: "start_recording" });

  if (S.videoConsentEnabled && S.videoStream) {
    startVideoCapture();
  }

  // Optimistic UI update (server will confirm via state_change)
  updateUI(SessionState.RECORDING);
  updateElapsedTime(0);
}

export function onStopSpeech() {
  // Stop the AudioWorklet but keep MediaStream alive for potential restart
  stopAudioCapture();

  // Phase 4: Stop video frame capture (camera stays alive for potential restart)
  stopVideoCapture();

  // Send stop_recording command to server
  wsSend({ type: "stop_recording" });

  // Optimistic UI update
  updateUI(SessionState.PROCESSING);
}

async function onDeliverEvaluation() {
  // Echo prevention: hard-stop mic tracks before TTS delivery
  hardStopMic();

  // Prime the audio element during the user gesture so the browser
  // grants playback permission. The real TTS source is swapped in
  // when the WebSocket delivers the audio data.
  primeTTSAudioElement();

  // Send deliver_evaluation command to server
  wsSend({ type: "deliver_evaluation" });

  // Optimistic UI update
  updateUI(SessionState.DELIVERING);
}

async function onReplayEvaluation() {
  // Guard: don't replay during cooldown
  if (S.inCooldown) return;

  // Echo prevention: hard-stop mic before replay (same as initial delivery)
  hardStopMic();

  // Prime the audio element during the user gesture (same as deliver)
  primeTTSAudioElement();

  // Send replay_tts command to server
  wsSend({ type: "replay_tts" });

  // Optimistic UI update to DELIVERING state
  updateUI(SessionState.DELIVERING);
}

// ─── Mode Switching (#68) ─────────────────────────────────────────
// currentMode now in S.currentMode (state.js)

function switchMode(mode) {
  S.currentMode = mode;
  const tabLive = document.getElementById("tab-live");
  const tabUpload = document.getElementById("tab-upload");
  const btnStart = document.getElementById("btn-start");
  const btnUpload = document.getElementById("btn-upload");
  const btnPanic = document.getElementById("btn-panic");
  const videoContainer = document.querySelector(".video-preview-container");

  tabLive.classList.toggle("active", mode === "live");
  tabUpload.classList.toggle("active", mode === "upload");

  // Live mode: show start + panic, hide upload
  // Upload mode: show upload, hide start + panic
  if (mode === "live") {
    btnStart.classList.remove("hidden");
    btnPanic.classList.remove("hidden");
    btnUpload.classList.add("hidden");
    if (videoContainer) videoContainer.classList.add("visible");
  } else {
    btnStart.classList.add("hidden");
    btnPanic.classList.add("hidden");
    btnUpload.classList.remove("hidden");
    if (videoContainer) videoContainer.classList.remove("visible");
  }
}

// ─── PDF Export (#71) ────────────────────────────────────────────────
function onExportPDF() {
  // Use browser print dialog with CSS print stylesheet
  // This captures the evaluation panel, transcript, and role results
  const originalTitle = document.title;
  const speakerName = S.consentSpeakerName || "Speech";
  const date = new Date().toISOString().slice(0, 10);
  document.title = `${speakerName} - Evaluation - ${date}`;

  window.print();
  document.title = originalTitle;
}

function onSaveOutputs() {
  // Guard: don't save if data was purged
  if (S.dataPurged) return;

  // Send save_outputs command to server
  wsSend({ type: "save_outputs" });
  disable(dom.btnSave);
}

function onRevokeConsent() {
  // Confirmation dialog per privacy-and-retention.md and meeting-safety-controls.md
  const confirmed = window.confirm(
    "This will permanently delete all data from this speech. Continue?"
  );
  if (!confirmed) return;

  // Hard-stop mic if recording
  hardStopMic();
  // Phase 4: Release camera on consent revocation
  releaseCamera();
  // Clear speech recording (#60)
  S.speechRecordingChunks = [];
  S.speechRecordingBlob = null;
  // Atomic: cancel deferral + bump token + stop audio + clear S.ttsPlaying + clear latch
  forceStopTtsAndCancelDeferral();
  clearCooldown();

  // Send revoke_consent command to server
  wsSend({ type: "revoke_consent" });

  // The server will respond with data_purged message which handles the rest
}

function onPanicMute() {
  // Panic mute: immediate action, no confirmation dialog
  // Hard-stop mic immediately
  hardStopMic();
  // Phase 4: Stop video capture immediately
  stopVideoCapture();
  // Clear speech recording (#60)
  S.speechRecordingChunks = [];
  S.speechRecordingBlob = null;
  // Atomic: cancel deferral + bump token + stop audio + clear S.ttsPlaying + clear latch
  forceStopTtsAndCancelDeferral();
  clearCooldown();
  // Reset pipeline state on panic mute (Req 6.3)
  S.pipelineStage = "idle";
  S.pipelineRunId = 0;

  // Send panic_mute command to server
  wsSend({ type: "panic_mute" });

  // Optimistic UI update
  updateUI(SessionState.IDLE);
  showInterruptionBanner();
}


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
function encodeVideoFrameBrowser(header, jpegBytes) {
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
async function checkMultipleCameras() {
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
async function onCameraFlip() {
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
function startVideoCapture() {
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
function stopVideoCapture() {
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
function updateVideoFrameStats() {
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
function handleVideoStatus(message) {
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
function showVideoQualityGrade(grade) {
  if (!videoDom.qualityGrade) return;
  videoDom.qualityGrade.className = "video-quality-grade visible " + grade;
  var labels = { good: "Video: Good", degraded: "Video: Degraded", poor: "Video: Poor" };
  videoDom.qualityGrade.textContent = labels[grade] || "Video: " + grade;
}

// ─── Initialize ───────────────────────────────────────────────────
// Set initial UI state and establish WebSocket connection
updateUI(SessionState.IDLE);

// Restore form state from localStorage (#58)
restoreFormState();

// ─── Theme Toggle (#56) ──────────────────────────────────────────
const themeToggleBtn = document.getElementById("theme-toggle");
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.textContent = theme === "light" ? "☀️" : "🌙";
  themeToggleBtn.title = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  try { localStorage.setItem("speech-evaluator-theme", theme); } catch (e) { /* ignore */ }
}
// Initialize: localStorage > prefers-color-scheme > dark default
const savedTheme = (() => { try { return localStorage.getItem("speech-evaluator-theme"); } catch (e) { return null; } })();
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
themeToggleBtn.addEventListener("click", function () {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// WebSocket is connected on demand when "Start Speech" is clicked (#59)
dom.connectionStatus.textContent = "Ready";
dom.connectionStatus.style.color = "var(--text-muted)";

// Check mic availability on load (non-blocking)
checkMicPermission();

// Fetch and display app version in footer
fetch("/api/version")
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.version) {
      document.getElementById("app-footer").textContent =
        "AI Speech Evaluator \u2014 v" + data.version;
    }
  })
  .catch(function () { /* footer stays as default text */ });

// ─── Phase 2: Consent & Time Limit Event Listeners ────────────────
// Listen for consent form changes
dom.speakerNameInput.addEventListener("input", onConsentChange);
dom.consentCheckbox.addEventListener("change", onConsentChange);

// Listen for time limit changes
dom.timeLimitInput.addEventListener("change", onTimeLimitChange);

// Phase 3: Listen for VAD config changes
dom.vadEnabledCheckbox.addEventListener("change", onVADConfigChange);
dom.vadThresholdSlider.addEventListener("change", onVADConfigChange);
dom.vadThresholdSlider.addEventListener("input", onVADThresholdInput);

// Phase 3: Listen for project context form changes
dom.speechTitleInput.addEventListener("input", onSpeechTitleChange);
dom.projectTypeSelect.addEventListener("change", onProjectTypeChange);
dom.objectivesTextarea.addEventListener("input", onObjectivesChange);

// Phase 4: Listen for video consent and FPS config changes
dom.videoConsentCheckbox.addEventListener("change", onVideoConsentChange);
dom.videoFpsSlider.addEventListener("change", onVideoFpsChange);
dom.videoFpsSlider.addEventListener("input", onVideoFpsInput);


// ─── Module → Global Bridge ──────────────────────────────────────
// Expose functions referenced by HTML onclick/onchange attributes.
// These are needed because <script type="module"> scopes all
// declarations — inline HTML handlers can only call window-level functions.
// TODO(#80): Remove this bridge when inline handlers are migrated to addEventListener.
window.signOut = signOut;
window.dismissError = dismissError;
window.onVADConfirmStop = onVADConfirmStop;
window.onVADDismiss = onVADDismiss;
window.onCameraFlip = onCameraFlip;
window.toggleVideoSize = toggleVideoSize;
window.onStartSpeech = onStartSpeech;
window.onStopSpeech = onStopSpeech;
window.onDeliverEvaluation = onDeliverEvaluation;
window.onReplayEvaluation = onReplayEvaluation;
window.onSaveOutputs = onSaveOutputs;
window.onExportPDF = onExportPDF;
window.switchMode = switchMode;
window.onRevokeConsent = onRevokeConsent;
window.onPanicMute = onPanicMute;
window.onFileSelected = onFileSelected;
window.onFormFileSelected = onFormFileSelected;

// Set initial mode state (#68)
switchMode("live");
