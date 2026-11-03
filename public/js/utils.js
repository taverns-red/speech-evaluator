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
