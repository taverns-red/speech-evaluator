# Lessons Learned

## 2026-02-25: Initial Project Evaluation

1. **Monolithic frontend is a maintenance risk**: The 3887-line `index.html` with inline CSS (~1060 lines) and JS (~2500 lines) makes it hard to reason about styling vs behavior. Extracting CSS into a separate file is the first step toward maintainability.

2. **Type contracts must match client code**: The `video_stream_ready` message type requires `width` and `height` fields, but the client never sends them. The server ignores them, so no runtime crash, but this is a protocol violation that could bite future developers who trust the type definition.

3. **Property-based testing is highly effective**: 1506 tests across 43 files with extensive fast-check property tests caught edge cases in video processing (frame gaps, resolution changes, temporal integrity) that unit tests alone would miss.

4. **Always check footer/version indicators**: The footer said "Phase 2" despite Phase 4 being fully implemented. These cosmetic details erode user confidence.

5. **CSS extraction reduces index.html by ~30%**: Moving 1060 lines of inline CSS to an external file made `index.html` drop from 3894 to 2851 lines. This improves maintainability and enables caching the CSS independently of the HTML.

6. **CSS variable names matter for migration**: When renaming CSS custom properties (e.g., `--color-text-muted` → `--text-muted`), grep the JS for inline style references like `style.color = "var(--color-text-muted)"`. These are easy to miss and will silently fail.

7. **Unicode in CSS comments breaks text-matching tools**: CSS files with box-drawing characters (─) in comment headers cause exact-string-matching tools to fail because the tool representation may encode them differently. Use `sed` line-number ranges instead.

8. **Never hardcode version in tests**: The `index.test.ts` asserted `APP_VERSION === "0.1.0"` which broke on every version bump. Instead, read `package.json` dynamically in the test and assert `APP_VERSION === pkg.version` — this validates the plumbing without coupling to a specific version string.
