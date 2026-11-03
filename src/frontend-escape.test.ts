/**
 * Frontend HTML-escaping tests (#199) — CodeQL js/xss, js/xss-through-dom.
 *
 * escapeHtml() output is interpolated into both element content and
 * double-quoted attributes (e.g. data-src="…", href="…"), so it must
 * escape quotes as well as <, > and &.
 */
import { escapeHtml, renderSpeakerAttrs } from "../public/js/utils.js";

describe("escapeHtml", () => {
  it("escapes element-content metacharacters", () => {
    expect(escapeHtml("<img src=x onerror=alert(1)>&")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;&amp;",
    );
  });

  it("escapes double and single quotes so attribute values cannot break out", () => {
    expect(escapeHtml(`x" onmouseover="alert(1)`)).toBe("x&quot; onmouseover=&quot;alert(1)");
    expect(escapeHtml("x' onmouseover='alert(1)")).toBe("x&#39; onmouseover=&#39;alert(1)");
  });

  it("treats null/undefined as empty and stringifies other values", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(7)).toBe("7");
  });
});

describe("renderSpeakerAttrs", () => {
  it("renders an integer speaker id", () => {
    expect(renderSpeakerAttrs(2)).toEqual({
      dataAttr: ' data-speaker="2"',
      label: '<span class="speaker-label speaker-2">Speaker 3:</span> ',
    });
  });

  it("renders nothing when the speaker id is absent", () => {
    expect(renderSpeakerAttrs(undefined)).toEqual({ dataAttr: "", label: "" });
  });

  it("drops non-integer speaker ids instead of injecting them into markup", () => {
    expect(renderSpeakerAttrs('0"><img src=x onerror=alert(1)>')).toEqual({ dataAttr: "", label: "" });
    expect(renderSpeakerAttrs(-1)).toEqual({ dataAttr: "", label: "" });
    expect(renderSpeakerAttrs(1.5)).toEqual({ dataAttr: "", label: "" });
  });
});
