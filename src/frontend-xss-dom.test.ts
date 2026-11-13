// @vitest-environment jsdom
/**
 * Real-DOM sink tests (#207). These render through the production functions
 * into a jsdom document and assert that attacker-controlled strings never
 * become elements or attributes — they must appear as text only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const PAYLOAD = "<img src=x onerror=alert(1)>";
const ATTR_PAYLOAD = '"><img src=x onerror=alert(1)>';

function setupBody() {
  document.body.innerHTML = `
    <div id="transcript-panel"><div id="transcript-content"></div><span id="transcript-word-count"></span></div>
    <div id="evaluation-panel"><div id="evaluation-content"></div></div>
    <div id="meetings-panel"></div><button id="upload-cancel-btn"></button>`;
}

beforeEach(() => {
  vi.resetModules();
  setupBody();
});

describe("renderTranscript (real DOM)", () => {
  it("shows markup in segment text as text, with no <img> element", async () => {
    const { S } = await import("../public/js/state.js");
    const { renderTranscript } = await import("../public/js/transcript.js");
    S.segments = [{ text: PAYLOAD, startTime: 1, isFinal: true, speakerId: 0 }] as never;
    renderTranscript();
    const root = document.getElementById("transcript-content")!;
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain(PAYLOAD);
  });
});

describe("upload result rendering (real DOM)", () => {
  it("renders the transcript paragraph as text only", async () => {
    const { renderUploadTranscript } = await import("../public/js/upload.js");
    const root = document.getElementById("transcript-content")!;
    renderUploadTranscript(root, [{ text: PAYLOAD }, { text: "second" }]);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("p")?.textContent).toBe(PAYLOAD + " second");
  });

  it("formatUploadedEvaluation escapes every interpolated field", async () => {
    const { formatUploadedEvaluation } = await import("../public/js/upload.js");
    const root = document.getElementById("evaluation-content")!;
    root.innerHTML = formatUploadedEvaluation(
      {
        opening: PAYLOAD,
        closing: PAYLOAD,
        items: [
          { type: PAYLOAD, summary: "", explanation: PAYLOAD, evidence_quote: PAYLOAD },
          { type: "commendation", summary: PAYLOAD, explanation: PAYLOAD, evidence_quote: PAYLOAD },
        ],
      },
      undefined,
      0.5,
    );
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain(PAYLOAD);
  });

  it("formatUploadedMetrics escapes non-numeric fields", async () => {
    const { formatUploadedMetrics } = await import("../public/js/upload.js");
    const root = document.getElementById("evaluation-content")!;
    root.innerHTML = formatUploadedMetrics({
      totalWords: PAYLOAD, wordsPerMinute: PAYLOAD, durationFormatted: PAYLOAD, fillerWordCount: PAYLOAD, pauseCount: PAYLOAD,
    });
    expect(root.querySelector("img")).toBeNull();
  });
});

describe("meeting history list (real DOM)", () => {
  it("renders meetingId, meetingDate and counts as inert text/attributes", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        results: [{ meetingId: ATTR_PAYLOAD, meetingDate: PAYLOAD, clubName: PAYLOAD, completedCount: PAYLOAD, slotCount: PAYLOAD }],
      }),
    }));
    const { loadMeetingHistory } = await import("../public/js/history.js");
    await loadMeetingHistory();
    const panel = document.getElementById("meetings-panel")!;
    expect(panel.querySelector("img")).toBeNull();
    expect(panel.querySelector(".meeting-history-date")?.textContent).toBe(PAYLOAD);
    expect(panel.querySelector(".meeting-history-header")?.getAttribute("data-meeting-id")).toBe(ATTR_PAYLOAD);
    vi.unstubAllGlobals();
  });
});

describe("sanitizeUrl (real DOM, same-origin enforcement)", () => {
  it.each(["/\\evil.com", "/\t/evil.com", "/\n/evil.com", "//evil.com", "\\\\evil.com", "javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", ""])(
    "rejects %j",
    async (u) => {
      const { sanitizeUrl } = await import("../public/js/utils.js");
      expect(sanitizeUrl(u)).toBe("");
    },
  );
  it.each(["/audio/x.mp3", "https://storage.googleapis.com/bucket/a.mp3?X-Goog-Signature=abc"])("accepts %j", async (u) => {
    const { sanitizeUrl } = await import("../public/js/utils.js");
    expect(sanitizeUrl(u)).toBe(u);
  });
  it("accepts blob: only with allowBlob", async () => {
    const { sanitizeUrl } = await import("../public/js/utils.js");
    expect(sanitizeUrl("blob:http://localhost/abc")).toBe("");
    expect(sanitizeUrl("blob:http://localhost/abc", { allowBlob: true })).toBe("blob:http://localhost/abc");
  });
});
