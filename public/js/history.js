/**
 * History module — browse past evaluations stored in GCS (#123).
 * Fetches from GET /api/history/:speaker, renders list with expand/play/download.
 */

// ─── State ──────────────────────────────────────────────────────────
let historyLoaded = false;
let historyLoading = false;
let historyNextCursor = null;
let historySpeaker = "";
let historyResults = [];

// ─── DOM References ─────────────────────────────────────────────────
function getHistoryPanel() {
  return document.getElementById("history-panel");
}

function getHistoryList() {
  return document.getElementById("history-list");
}

function getHistoryEmpty() {
  return document.getElementById("history-empty");
}

function getHistoryLoadMore() {
  return document.getElementById("history-load-more");
}

function getHistorySpinner() {
  return document.getElementById("history-spinner");
}

// ─── API ────────────────────────────────────────────────────────────

async function fetchHistory(speaker, cursor) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);

  const encoded = encodeURIComponent(speaker);
  const res = await fetch(`/api/history/${encoded}?${params}`);
  if (!res.ok) throw new Error(`History API error: ${res.status}`);
  return res.json();
}

async function deleteEvaluationApi(speaker, prefix) {
  const encodedSpeaker = encodeURIComponent(speaker);
  const encodedPrefix = encodeURIComponent(prefix);
  const res = await fetch(`/api/history/${encodedSpeaker}/${encodedPrefix}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete API error: ${res.status}`);
  return res.json();
}

// ─── Rendering ──────────────────────────────────────────────────────

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPassRate(rate) {
  return `${Math.round(rate * 100)}%`;
}

function renderHistoryItem(item, index) {
  const { metadata, urls } = item;
  const div = document.createElement("div");
  div.className = "history-item";
  div.setAttribute("data-index", String(index));

  const passRateClass = metadata.passRate >= 0.7 ? "pass-good" : metadata.passRate >= 0.4 ? "pass-fair" : "pass-poor";

  div.innerHTML = `
    <div class="history-item-header" role="button" tabindex="0" aria-expanded="false">
      <div class="history-item-meta">
        <span class="history-date">${escapeHtml(formatDate(metadata.date))}</span>
        <span class="history-title">${escapeHtml(metadata.speechTitle || "Untitled")}</span>
      </div>
      <div class="history-item-stats">
        ${metadata.projectType ? `<span class="history-tag">${escapeHtml(metadata.projectType)}</span>` : ""}
        <span class="history-stat">${formatDuration(metadata.durationSeconds)}</span>
        <span class="history-stat">${Math.round(metadata.wordsPerMinute)} WPM</span>
        <span class="history-pass ${passRateClass}">${formatPassRate(metadata.passRate)}</span>
        <span class="history-expand-icon">▸</span>
      </div>
    </div>
    <div class="history-item-detail" style="display:none;"></div>
  `;

  // Click to expand
  const header = div.querySelector(".history-item-header");
  header.addEventListener("click", () => toggleHistoryDetail(div, item));
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleHistoryDetail(div, item);
    }
  });

  return div;
}

async function toggleHistoryDetail(div, item) {
  const detail = div.querySelector(".history-item-detail");
  const header = div.querySelector(".history-item-header");
  const icon = div.querySelector(".history-expand-icon");
  const isExpanded = detail.style.display !== "none";

  if (isExpanded) {
    detail.style.display = "none";
    header.setAttribute("aria-expanded", "false");
    icon.textContent = "▸";
    return;
  }

  // Expand
  header.setAttribute("aria-expanded", "true");
  icon.textContent = "▾";
  detail.style.display = "block";
  detail.innerHTML = '<div class="history-loading-detail">Loading evaluation...</div>';

  try {
    // Fetch evaluation data from signed URL
    const { urls } = item;
    let evalData = null;
    if (urls.evaluation) {
      const res = await fetch(urls.evaluation);
      if (res.ok) evalData = await res.json();
    }

    let html = '<div class="history-detail-content">';

    // Audio player
    if (urls.audio) {
      html += `
        <div class="history-audio-section">
          <button class="history-play-btn" data-src="${escapeHtml(urls.audio)}">▶ Play Evaluation</button>
          <audio class="history-audio-player" preload="none"></audio>
        </div>
      `;
    }

    // Evaluation items
    if (evalData && evalData.evaluation) {
      const evaluation = evalData.evaluation;

      if (evaluation.opening) {
        html += `<div class="history-eval-opening">${escapeHtml(evaluation.opening)}</div>`;
      }

      if (evaluation.items && evaluation.items.length > 0) {
        html += '<div class="history-eval-items">';
        for (const ei of evaluation.items) {
          const typeIcon = ei.type === "commendation" ? "✅" : "💡";
          html += `
            <div class="history-eval-item ${ei.type}">
              <div class="history-eval-item-header">${typeIcon} <strong>${escapeHtml(ei.summary)}</strong></div>
              <div class="history-eval-item-body">${escapeHtml(ei.explanation)}</div>
              ${ei.evidence_quote ? `<div class="history-eval-evidence">"${escapeHtml(ei.evidence_quote)}"</div>` : ""}
            </div>
          `;
        }
        html += "</div>";
      }

      if (evaluation.closing) {
        html += `<div class="history-eval-closing">${escapeHtml(evaluation.closing)}</div>`;
      }
    } else {
      html += '<div class="history-no-eval">Evaluation data unavailable.</div>';
    }

    // Links
    html += '<div class="history-links">';
    if (urls.transcript) html += `<a href="${escapeHtml(urls.transcript)}" target="_blank" class="history-link">📄 Transcript</a>`;
    if (urls.metrics) html += `<a href="${escapeHtml(urls.metrics)}" target="_blank" class="history-link">📊 Metrics</a>`;
    html += `<button class="history-delete-btn" title="Delete this evaluation">🗑️ Delete</button>`;
    html += "</div>";

    html += "</div>";
    detail.innerHTML = html;

    // Wire audio play button
    const playBtn = detail.querySelector(".history-play-btn");
    if (playBtn) {
      const audio = detail.querySelector(".history-audio-player");
      playBtn.addEventListener("click", () => {
        if (audio.paused || !audio.src) {
          audio.src = playBtn.getAttribute("data-src");
          audio.play();
          playBtn.textContent = "⏸ Pause";
        } else {
          audio.pause();
          playBtn.textContent = "▶ Play Evaluation";
        }
      });
      audio.addEventListener("ended", () => {
        playBtn.textContent = "▶ Play Evaluation";
      });
    }
    // Wire delete button (#128)
    const deleteBtn = detail.querySelector(".history-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = confirm(`Delete evaluation "${item.metadata.speechTitle || "Untitled"}"? This cannot be undone.`);
        if (!ok) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = "Deleting...";
        try {
          await deleteEvaluationApi(item.metadata.speakerName, item.metadata.prefix);
          // Remove from list
          div.remove();
          historyResults = historyResults.filter(r => r.metadata.prefix !== item.metadata.prefix);
          if (historyResults.length === 0) {
            const emptyEl = getHistoryEmpty();
            if (emptyEl) emptyEl.style.display = "block";
          }
        } catch (err) {
          console.error("[History] Failed to delete:", err);
          deleteBtn.textContent = "🗑️ Delete";
          deleteBtn.disabled = false;
          alert("Failed to delete: " + err.message);
        }
      });
    }
  } catch (err) {
    detail.innerHTML = `<div class="history-error">Failed to load evaluation: ${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Load History ───────────────────────────────────────────────────

export async function loadHistory(speaker) {
  if (!speaker || speaker.trim().length === 0) return;
  if (historyLoading) return;

  // If speaker changed, reset
  if (speaker !== historySpeaker) {
    historySpeaker = speaker;
    historyResults = [];
    historyNextCursor = null;
    historyLoaded = false;
  }

  historyLoading = true;
  const spinner = getHistorySpinner();
  const emptyEl = getHistoryEmpty();
  const listEl = getHistoryList();
  const loadMoreBtn = getHistoryLoadMore();

  if (spinner) spinner.style.display = "flex";
  if (emptyEl) emptyEl.style.display = "none";
  if (loadMoreBtn) loadMoreBtn.style.display = "none";

  try {
    const data = await fetchHistory(speaker, historyNextCursor);
    historyNextCursor = data.nextCursor || null;
    historyLoaded = true;

    if (data.results.length === 0 && historyResults.length === 0) {
      // Empty state
      if (emptyEl) emptyEl.style.display = "block";
    } else {
      // Append results
      for (const item of data.results) {
        historyResults.push(item);
        const el = renderHistoryItem(item, historyResults.length - 1);
        if (listEl) listEl.appendChild(el);
      }

      // Show/hide load more
      if (loadMoreBtn) {
        loadMoreBtn.style.display = historyNextCursor ? "block" : "none";
      }
    }
  } catch (err) {
    console.error("[History] Failed to load:", err);
    if (listEl) {
      const errDiv = document.createElement("div");
      errDiv.className = "history-error";
      errDiv.textContent = "Failed to load evaluation history. Please try again.";
      listEl.appendChild(errDiv);
    }
  } finally {
    historyLoading = false;
    if (spinner) spinner.style.display = "none";
  }
}

// ─── Reset (on speaker change) ──────────────────────────────────────

export function resetHistory() {
  historyLoaded = false;
  historyLoading = false;
  historyNextCursor = null;
  historySpeaker = "";
  historyResults = [];

  const listEl = getHistoryList();
  if (listEl) listEl.innerHTML = "";

  const emptyEl = getHistoryEmpty();
  if (emptyEl) emptyEl.style.display = "none";
}

export function isHistoryLoaded() {
  return historyLoaded;
}
