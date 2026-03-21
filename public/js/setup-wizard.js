/**
 * Setup Wizard — first-run guided configuration for new users (#156).
 * Shows a multi-step modal on first visit (localStorage flag),
 * walks through speaker name, feedback style, and analysis depth.
 */
import { dom } from "./state.js";

const SETUP_KEY = "speechEval_setupComplete";

// ─── Step Definitions ───────────────────────────────────────────────

const FEEDBACK_STYLES = [
  { value: "classic", label: "Classic", desc: "Commendations & recommendations" },
  { value: "sbi", label: "SBI", desc: "Situation · Behavior · Impact" },
  { value: "feedforward", label: "Feedforward", desc: "Future-focused suggestions" },
  { value: "coin", label: "COIN", desc: "Context · Observation · Impact · Next" },
  { value: "holistic", label: "Holistic", desc: "Mind · Body · Voice · Story" },
  { value: "eec", label: "EEC", desc: "Example · Effect · Change/Continue" },
  { value: "radical_candour", label: "Radical Candour", desc: "Care personally + challenge directly" },
  { value: "socratic", label: "Socratic", desc: "Questions that guide self-reflection" },
  { value: "comparative", label: "Comparative", desc: "Before/after growth analysis" },
  { value: "micro_focus", label: "Micro-Focus", desc: "One skill drilled deep" },
];

const ANALYSIS_TIERS = [
  { value: "standard", label: "Standard", desc: "Text-only · ~$0.10", icon: "📝" },
  { value: "enhanced", label: "Enhanced", desc: "Text + Vision · ~$0.30", icon: "👁️" },
  { value: "detailed", label: "Detailed", desc: "Deep analysis · ~$0.50", icon: "🔬" },
  { value: "maximum", label: "Maximum", desc: "Full spectrum · ~$1.00", icon: "🚀" },
];

// ─── Wizard State ───────────────────────────────────────────────────

let currentStep = 0;
let wizardData = {
  speakerName: "",
  feedbackStyle: "classic",
  analysisTier: "standard",
};

// ─── Init ───────────────────────────────────────────────────────────

export function initSetupWizard() {
  if (localStorage.getItem(SETUP_KEY)) return; // Already completed

  const overlay = document.getElementById("setup-wizard-overlay");
  if (!overlay) return;

  currentStep = 0;
  wizardData = { speakerName: "", feedbackStyle: "classic", analysisTier: "standard" };

  renderStep(overlay);
  overlay.classList.add("visible");
}

// ─── Step Rendering ─────────────────────────────────────────────────

function renderStep(overlay) {
  const steps = [renderWelcome, renderNameStep, renderStyleStep, renderTierStep, renderDoneStep];
  overlay.innerHTML = "";

  const modal = document.createElement("div");
  modal.className = "setup-wizard-modal";

  // Step indicator
  const indicator = document.createElement("div");
  indicator.className = "setup-wizard-steps";
  for (let i = 0; i < steps.length; i++) {
    const dot = document.createElement("div");
    dot.className = "setup-wizard-dot" + (i === currentStep ? " active" : i < currentStep ? " completed" : "");
    indicator.appendChild(dot);
  }
  modal.appendChild(indicator);

  // Content
  const content = document.createElement("div");
  content.className = "setup-wizard-content";
  steps[currentStep](content);
  modal.appendChild(content);

  overlay.appendChild(modal);
}

function renderWelcome(container) {
  container.innerHTML = `
    <div class="setup-wizard-icon">🎤</div>
    <h2>Welcome to AI Speech Evaluator</h2>
    <p>Get AI-powered feedback on your speeches in seconds. Let's set up your preferences.</p>
    <button class="setup-wizard-btn primary" id="wizard-next">Get Started</button>
  `;
  setTimeout(() => {
    document.getElementById("wizard-next")?.addEventListener("click", () => nextStep());
  }, 0);
}

function renderNameStep(container) {
  container.innerHTML = `
    <div class="setup-wizard-icon">👤</div>
    <h2>What's your name?</h2>
    <p>This will be used to identify your evaluations and track your progress.</p>
    <input type="text" id="wizard-name" class="setup-wizard-input" placeholder="Your name" autocomplete="name" />
    <div class="setup-wizard-nav">
      <button class="setup-wizard-btn secondary" id="wizard-back">Back</button>
      <button class="setup-wizard-btn primary" id="wizard-next">Next</button>
    </div>
  `;
  setTimeout(() => {
    const input = document.getElementById("wizard-name");
    if (input) {
      input.value = wizardData.speakerName;
      input.focus();
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") nextStep(); });
    }
    document.getElementById("wizard-back")?.addEventListener("click", () => prevStep());
    document.getElementById("wizard-next")?.addEventListener("click", () => {
      const val = document.getElementById("wizard-name")?.value?.trim();
      if (val) wizardData.speakerName = val;
      nextStep();
    });
  }, 0);
}

function renderStyleStep(container) {
  const optionsHtml = FEEDBACK_STYLES.map((s) =>
    `<label class="setup-wizard-option${wizardData.feedbackStyle === s.value ? " selected" : ""}">
      <input type="radio" name="wizard-style" value="${s.value}" ${wizardData.feedbackStyle === s.value ? "checked" : ""}>
      <span class="setup-wizard-option-label">${s.label}</span>
      <span class="setup-wizard-option-desc">${s.desc}</span>
    </label>`
  ).join("");

  container.innerHTML = `
    <div class="setup-wizard-icon">🎨</div>
    <h2>Choose your feedback style</h2>
    <p>Different frameworks for how your evaluation is structured.</p>
    <div class="setup-wizard-options">${optionsHtml}</div>
    <div class="setup-wizard-nav">
      <button class="setup-wizard-btn secondary" id="wizard-back">Back</button>
      <button class="setup-wizard-btn primary" id="wizard-next">Next</button>
    </div>
  `;
  setTimeout(() => {
    container.querySelectorAll("input[name='wizard-style']").forEach((radio) => {
      radio.addEventListener("change", (e) => {
        wizardData.feedbackStyle = e.target.value;
        container.querySelectorAll(".setup-wizard-option").forEach((el) => el.classList.remove("selected"));
        e.target.closest(".setup-wizard-option")?.classList.add("selected");
      });
    });
    document.getElementById("wizard-back")?.addEventListener("click", () => prevStep());
    document.getElementById("wizard-next")?.addEventListener("click", () => nextStep());
  }, 0);
}

function renderTierStep(container) {
  const optionsHtml = ANALYSIS_TIERS.map((t) =>
    `<label class="setup-wizard-option tier${wizardData.analysisTier === t.value ? " selected" : ""}">
      <input type="radio" name="wizard-tier" value="${t.value}" ${wizardData.analysisTier === t.value ? "checked" : ""}>
      <span class="setup-wizard-option-icon">${t.icon}</span>
      <span class="setup-wizard-option-label">${t.label}</span>
      <span class="setup-wizard-option-desc">${t.desc}</span>
    </label>`
  ).join("");

  container.innerHTML = `
    <div class="setup-wizard-icon">📊</div>
    <h2>Select analysis depth</h2>
    <p>Higher tiers use Vision AI for body language analysis.</p>
    <div class="setup-wizard-options tier-options">${optionsHtml}</div>
    <div class="setup-wizard-nav">
      <button class="setup-wizard-btn secondary" id="wizard-back">Back</button>
      <button class="setup-wizard-btn primary" id="wizard-next">Next</button>
    </div>
  `;
  setTimeout(() => {
    container.querySelectorAll("input[name='wizard-tier']").forEach((radio) => {
      radio.addEventListener("change", (e) => {
        wizardData.analysisTier = e.target.value;
        container.querySelectorAll(".setup-wizard-option").forEach((el) => el.classList.remove("selected"));
        e.target.closest(".setup-wizard-option")?.classList.add("selected");
      });
    });
    document.getElementById("wizard-back")?.addEventListener("click", () => prevStep());
    document.getElementById("wizard-next")?.addEventListener("click", () => nextStep());
  }, 0);
}

function renderDoneStep(container) {
  const styleName = FEEDBACK_STYLES.find((s) => s.value === wizardData.feedbackStyle)?.label || wizardData.feedbackStyle;
  const tierName = ANALYSIS_TIERS.find((t) => t.value === wizardData.analysisTier)?.label || wizardData.analysisTier;

  container.innerHTML = `
    <div class="setup-wizard-icon">✨</div>
    <h2>You're all set!</h2>
    <div class="setup-wizard-summary">
      ${wizardData.speakerName ? `<div><strong>Speaker:</strong> ${wizardData.speakerName}</div>` : ""}
      <div><strong>Feedback Style:</strong> ${styleName}</div>
      <div><strong>Analysis Depth:</strong> ${tierName}</div>
    </div>
    <p>You can change these anytime from the main screen.</p>
    <button class="setup-wizard-btn primary" id="wizard-finish">Start Evaluating</button>
  `;
  setTimeout(() => {
    document.getElementById("wizard-finish")?.addEventListener("click", () => finishWizard());
  }, 0);
}

// ─── Navigation ─────────────────────────────────────────────────────

function nextStep() {
  const overlay = document.getElementById("setup-wizard-overlay");
  if (!overlay) return;
  currentStep = Math.min(currentStep + 1, 4);
  renderStep(overlay);
}

function prevStep() {
  const overlay = document.getElementById("setup-wizard-overlay");
  if (!overlay) return;
  currentStep = Math.max(currentStep - 1, 0);
  renderStep(overlay);
}

// ─── Apply Settings ─────────────────────────────────────────────────

function finishWizard() {
  // Apply speaker name
  if (wizardData.speakerName && dom.speakerNameInput) {
    dom.speakerNameInput.value = wizardData.speakerName;
    dom.speakerNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Apply feedback style
  const styleRadio = document.querySelector(`input[name="evaluation-style"][value="${wizardData.feedbackStyle}"]`);
  if (styleRadio) {
    styleRadio.checked = true;
    styleRadio.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Apply analysis tier
  const tierRadio = document.querySelector(`input[name="analysis-tier"][value="${wizardData.analysisTier}"]`);
  if (tierRadio) {
    tierRadio.checked = true;
    tierRadio.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Mark setup as complete
  localStorage.setItem(SETUP_KEY, "1");

  // Close wizard
  const overlay = document.getElementById("setup-wizard-overlay");
  if (overlay) {
    overlay.classList.remove("visible");
  }
}
