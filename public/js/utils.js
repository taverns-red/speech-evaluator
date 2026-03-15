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

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
