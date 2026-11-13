/**
 * Sink-level XSS tests (#207) — CodeQL js/xss (transcript.js),
 * js/xss-through-dom (history.js, upload.js).
 *
 * Untrusted text must reach the DOM only through textContent / setAttribute
 * on safe attributes, and URLs must be validated before use as src/href.
 */
import { buildSegmentElement, sanitizeUrl } from "../public/js/utils.js";


class FakeNode {
  children: FakeNode[] = [];
  attrs: Record<string, string> = {};
  textContent = "";
  constructor(public tag: string) {}
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  appendChild(c: FakeNode) { this.children.push(c); return c; }
  append(...cs: (FakeNode | string)[]) {
    for (const c of cs) this.children.push(typeof c === "string" ? Object.assign(new FakeNode("#text"), { textContent: c }) : c);
  }
  set className(v: string) { this.attrs.class = v; }
  all(): FakeNode[] { return [this, ...this.children.flatMap((c) => c.all())]; }
}
const fakeDoc = { createElement: (t: string) => new FakeNode(t), createTextNode: (s: string) => Object.assign(new FakeNode("#text"), { textContent: s }) };

describe("transcript segment rendering (js/xss)", () => {
  it("renders markup in transcript text as text, never as an element", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const el = buildSegmentElement({ text: payload, startTime: 1, isFinal: true, speakerId: 0 }, 0, fakeDoc) as unknown as FakeNode;
    expect(el.all().some((n) => n.tag === "img")).toBe(false);
    expect(el.all().some((n) => n.textContent === payload || n.textContent.includes(payload))).toBe(true);
    expect(el.attrs["data-segment-index"]).toBe("0");
  });

  it("drops a non-integer speaker id instead of putting it in an attribute", () => {
    const el = buildSegmentElement({ text: "hi", startTime: 0, isFinal: false, speakerId: '0"><b>' as never }, 3, fakeDoc) as unknown as FakeNode;
    expect(el.attrs["data-speaker"]).toBeUndefined();
    expect(el.attrs.class).toContain("interim");
  });
});

describe("sanitizeUrl (js/xss-through-dom)", () => {
  it("allows http, https and same-origin relative URLs", () => {
    expect(sanitizeUrl("https://example.com/a.mp3")).toBe("https://example.com/a.mp3");
    expect(sanitizeUrl("http://example.com/a")).toBe("http://example.com/a");
    expect(sanitizeUrl("/api/history/1/audio")).toBe("/api/history/1/audio");
  });
  it("rejects javascript:, data: and malformed URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl(" JaVaScRiPt:alert(1)")).toBe("");
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeUrl("//evil.example/x")).toBe("");
    expect(sanitizeUrl(undefined)).toBe("");
  });
  it("allows blob: only when explicitly requested (object URLs for local previews)", () => {
    expect(sanitizeUrl("blob:https://app.example/abc")).toBe("");
    expect(sanitizeUrl("blob:https://app.example/abc", { allowBlob: true })).toBe("blob:https://app.example/abc");
  });
});
