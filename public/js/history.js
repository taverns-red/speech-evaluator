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

async function fetchProgress(speaker) {
  const encoded = encodeURIComponent(speaker);
  const res = await fetch(`/api/progress/${encoded}`);
  if (!res.ok) throw new Error(`Progress API error: ${res.status}`);
  return res.json();
}

// ─── Progress Trend Chart (#140) ────────────────────────────────────

/**
 * Build an SVG sparkline from data points.
 * @param {number[]} values - Data values to plot
 * @param {string} color - Stroke color
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {string} SVG markup
 */
function buildSparkline(values, color, width = 200, height = 40) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 4;
  const plotH = height - padding * 2;
  const plotW = width - padding * 2;
  const step = plotW / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padding + i * step;
    const y = padding + plotH - ((v - min) / range) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  // Dot on last point
  const lastX = padding + (values.length - 1) * step;
  const lastY = padding + plotH - ((values[values.length - 1] - min) / range) * plotH;

  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${color}" />
  </svg>`;
}

/**
 * Compute the percentage change between first and last value.
 * Returns { arrow, text, className }.
 */
function trendDelta(values, lowerIsBetter = false) {
  if (!values || values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0) return null;
  const pct = ((last - first) / first) * 100;
  const improved = lowerIsBetter ? pct < 0 : pct > 0;
  const arrow = improved ? "↑" : "↓";
  const text = `${arrow} ${Math.abs(pct).toFixed(0)}%`;
  const className = improved ? "trend-positive" : "trend-negative";
  return { text, className };
}

function renderProgressPanel(progressData) {
  const panel = document.getElementById("progress-panel");
  if (!panel) return;

  const speeches = progressData.speeches;
  if (!speeches || speeches.length < 2) {
    panel.style.display = "none";
    return;
  }

  const wpmValues = speeches.map(s => s.wordsPerMinute);
  const passValues = speeches.map(s => Math.round(s.passRate * 100));
  const fillerValues = speeches.filter(s => s.fillerWordFrequency != null).map(s => s.fillerWordFrequency);

  const wpmTrend = trendDelta(wpmValues);
  const passTrend = trendDelta(passValues);
  const fillerTrend = trendDelta(fillerValues, true);

  let html = `<div class="progress-chart-panel">
    <div class="progress-header">
      <span class="progress-title">📈 Progress (${speeches.length} speeches)</span>
    </div>
    <div class="progress-metrics">`;

  // WPM sparkline
  html += `<div class="progress-metric">
    <div class="progress-metric-label">Words/Min</div>
    ${buildSparkline(wpmValues, "#4fc3f7")}
    <div class="progress-metric-value">${Math.round(wpmValues[wpmValues.length - 1])} WPM
      ${wpmTrend ? `<span class="${wpmTrend.className}">${escapeHtml(wpmTrend.text)}</span>` : ""}
    </div>
  </div>`;

  // Pass Rate sparkline
  html += `<div class="progress-metric">
    <div class="progress-metric-label">Pass Rate</div>
    ${buildSparkline(passValues, "#81c784")}
    <div class="progress-metric-value">${passValues[passValues.length - 1]}%
      ${passTrend ? `<span class="${passTrend.className}">${escapeHtml(passTrend.text)}</span>` : ""}
    </div>
  </div>`;

  // Filler Rate sparkline (only if data exists)
  if (fillerValues.length >= 2) {
    html += `<div class="progress-metric">
      <div class="progress-metric-label">Fillers/Min</div>
      ${buildSparkline(fillerValues, "#ffb74d")}
      <div class="progress-metric-value">${fillerValues[fillerValues.length - 1].toFixed(1)}/min
        ${fillerTrend ? `<span class="${fillerTrend.className}">${escapeHtml(fillerTrend.text)}</span>` : ""}
      </div>
    </div>`;
  }

  html += `</div></div>`;
  panel.innerHTML = html;
  panel.style.display = "block";
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

        // Non-classic styles: render style_items if present (#135)
        if (evaluation.evaluation_style && evaluation.evaluation_style !== "classic"
            && evaluation.style_items && evaluation.style_items.length > 0) {
          for (const si of evaluation.style_items) {
            html += renderHistoryStyleItem(si, evaluation.evaluation_style);
          }
        } else {
          // Classic: commendation/recommendation cards
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
        }

        html += "</div>";
      }

      // Category scores bar chart (#144)
      if (evaluation.category_scores && evaluation.category_scores.length > 0) {
        html += '<div class="history-category-scores">';
        html += '<div class="category-scores-label">Category Scores</div>';
        html += '<div class="category-scores-bars">';
        for (const cs of evaluation.category_scores) {
          const pct = Math.round((cs.score / 10) * 100);
          const colorClass = cs.score >= 7 ? "score-good" : cs.score >= 4 ? "score-fair" : "score-poor";
          const categoryLabel = cs.category.charAt(0).toUpperCase() + cs.category.slice(1);
          html += `
            <div class="category-score-row">
              <span class="category-score-name">${escapeHtml(categoryLabel)}</span>
              <div class="category-score-track">
                <div class="category-score-fill ${colorClass}" style="width:${pct}%"></div>
              </div>
              <span class="category-score-value">${cs.score}</span>
            </div>
          `;
        }
        html += '</div>';
        if (evaluation.category_scores.some(cs => cs.rationale && cs.rationale !== "No rationale provided")) {
          html += '<details class="category-scores-rationale"><summary>View rationales</summary>';
          for (const cs of evaluation.category_scores) {
            if (cs.rationale && cs.rationale !== "No rationale provided") {
              const categoryLabel = cs.category.charAt(0).toUpperCase() + cs.category.slice(1);
              html += `<div class="rationale-item"><strong>${escapeHtml(categoryLabel)}:</strong> ${escapeHtml(cs.rationale)}</div>`;
            }
          }
          html += '</details>';
        }
        html += '</div>';
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

// ─── Style Item Rendering for History (#135) ───────────────────────

/** Style field configuration (mirrors transcript.js STYLE_FIELD_CONFIG) */
const HISTORY_STYLE_CONFIG = {
  sbi: {
    icon: (item) => item.valence === "positive" ? "✅" : "💡",
    fields: [
      { key: "situation", label: "Situation" },
      { key: "behavior", label: "Behavior" },
      { key: "impact", label: "Impact" },
    ],
  },
  feedforward: {
    icon: () => "🔮",
    fields: [
      { key: "observation", label: "Observation" },
      { key: "nextTime", label: "Next Time" },
    ],
  },
  coin: {
    icon: () => "🪙",
    fields: [
      { key: "context", label: "Context" },
      { key: "observation", label: "Observation" },
      { key: "impact", label: "Impact" },
      { key: "nextSteps", label: "Next Steps" },
    ],
  },
  holistic: {
    icon: (item) => ({ heard: "👂", saw: "👁️", felt: "💭" }[item.category] || "📝"),
    fields: [
      { key: "category", label: "Category" },
      { key: "observation", label: "Observation" },
      { key: "detail", label: "Detail" },
    ],
  },
};

function renderHistoryStyleItem(item, evaluationStyle) {
  const config = HISTORY_STYLE_CONFIG[evaluationStyle];
  if (!config) return `<div class="history-eval-item"><pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre></div>`;

  const icon = config.icon(item);
  let fieldsHtml = "";
  for (const f of config.fields) {
    const val = item[f.key];
    if (!val) continue;
    fieldsHtml += `<div class="style-item-field"><span class="style-field-label">${escapeHtml(f.label)}</span><span class="style-field-value">${escapeHtml(val)}</span></div>`;
  }

  return `<div class="style-item-card"><div class="style-item-header">${icon}</div>${fieldsHtml}</div>`;
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

    // Fetch progress data on first load (#140)
    if (!historyNextCursor || historyResults.length === 0) {
      try {
        const progress = await fetchProgress(speaker);
        renderProgressPanel(progress);
      } catch (progressErr) {
        console.warn("[History] Progress chart unavailable:", progressErr);
      }
    }

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

  const progressPanel = document.getElementById("progress-panel");
  if (progressPanel) { progressPanel.style.display = "none"; progressPanel.innerHTML = ""; }
}

export function isHistoryLoaded() {
  return historyLoaded;
}
