/**
 * Frontend Utilities — shared helper functions for the speech evaluator UI.
 * Extracted from index.html for ES module pattern (#80).
 */

// ─── Visibility Helpers ──────────────────────────────────────────────

/**
 * Shows an element by adding 'visible' and removing 'hidden' class.
 * @param {HTMLElement} el
 */
export function show(el) {
  el.classList.add("visible");
  el.classList.remove("hidden");
}

/**
 * Hides an element by removing 'visible' and adding 'hidden' class.
 * @param {HTMLElement} el
 */
export function hide(el) {
  el.classList.remove("visible");
  el.classList.add("hidden");
}

/**
 * Enables an element.
 * @param {HTMLElement} el
 */
export function enable(el) {
  el.disabled = false;
}

/**
 * Disables an element.
 * @param {HTMLElement} el
 */
export function disable(el) {
  el.disabled = true;
}

// ─── Formatting Helpers ──────────────────────────────────────────────

/**
 * Formats seconds into MM:SS timestamp string.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimestamp(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes HTML special characters to prevent XSS. Safe for element content
 * and for quoted attribute values (quotes are escaped too) (#199).
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Builds the speaker data attribute and label markup for a transcript segment.
 * Only non-negative integer speaker ids are rendered; anything else is dropped
 * so untrusted values never reach innerHTML (#199).
 * @param {unknown} speakerId
 * @returns {{ dataAttr: string, label: string }}
 */
export function renderSpeakerAttrs(speakerId) {
  if (!Number.isInteger(speakerId) || speakerId < 0) return { dataAttr: "", label: "" };
  return {
    dataAttr: ' data-speaker="' + speakerId + '"',
    label: '<span class="speaker-label speaker-' + (speakerId % 6) + '">Speaker ' + (speakerId + 1) + ':</span> ',
  };
}

/**
 * Validates a URL before it is used as an element src/href (#207).
 * Allows http(s) and same-origin relative paths; blob: only on request
 * (local object URLs). Returns "" for anything else.
 * @param {unknown} url
 * @param {{ allowBlob?: boolean }} [opts]
 * @returns {string}
 */
export function sanitizeUrl(url, opts = {}) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("\\")) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    const scheme = trimmed.slice(0, trimmed.indexOf(":")).toLowerCase();
    if (scheme === "http" || scheme === "https") return trimmed;
    if (scheme === "blob" && opts.allowBlob) return trimmed;
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : "";
}

/**
 * Builds a transcript segment element using only createElement/textContent,
 * so transcript text is never parsed as HTML (#207).
 * @param {{text: string, startTime: number, isFinal: boolean, speakerId?: unknown}} seg
 * @param {number} idx
 * @param {Document} doc
 * @returns {HTMLElement}
 */
export function buildSegmentElement(seg, idx, doc) {
  const el = doc.createElement("div");
  el.className = "segment" + (seg.isFinal ? "" : " interim");
  const time = doc.createElement("span");
  time.className = "segment-time";
  time.textContent = "[" + formatTimestamp(seg.startTime) + "]";
  el.appendChild(time);
  if (Number.isInteger(seg.speakerId) && seg.speakerId >= 0) {
    el.setAttribute("data-speaker", String(seg.speakerId));
    const label = doc.createElement("span");
    label.className = "speaker-label speaker-" + (seg.speakerId % 6);
    label.textContent = "Speaker " + (seg.speakerId + 1) + ":";
    el.appendChild(label);
    el.appendChild(doc.createTextNode(" "));
  }
  el.appendChild(doc.createTextNode(seg.text));
  el.setAttribute("data-segment-index", String(idx));
  return el;
}
