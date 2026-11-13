/**
 * Frontend HTML-escaping tests (#199) — CodeQL js/xss, js/xss-through-dom.
 *
 * escapeHtml() output is interpolated into both element content and
 * double-quoted attributes (e.g. data-src="…", href="…"), so it must
 * escape quotes as well as <, > and &.
 */
import { escapeHtml } from "../public/js/utils.js";

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
