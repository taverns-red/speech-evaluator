# 📚 Lessons Learned

<!-- TEMPLATE — Every lesson MUST use this exact structure. Newest entries go at the top. -->
<!-- The agent reads the last 5 entries before starting any task.                         -->
<!--                                                                                      -->
<!-- ## 🗓️ [YYYY-MM-DD] — Lesson NN: [Title]                                             -->
<!--                                                                                      -->
<!-- **The Discovery**: [What unexpected behavior or coupling was found]                   -->
<!--                                                                                      -->
<!-- **The Scientific Proof**: [How the hypothesis was tested — link to experiment]        -->
<!--                                                                                      -->
<!-- **The Farley Principle Applied**: [Which engineering principle this reinforces]        -->
<!--                                                                                      -->
<!-- **The Resulting Rule**: [The new rule or constraint going forward]                    -->
<!--                                                                                      -->
<!-- **Future Warning**: [What to watch for — a tripwire for the agent]                    -->

## 🗓️ 2026-02-26 — Lesson 09: Stub Detectors Unblock Grading; Upload Pipeline Needs Direct Dep Injection

**The Discovery**: `SessionManager` passes `{}` to `VideoProcessor` — no detectors → capabilities `{ face: false, pose: false }` → quality always "poor". Real ML requires heavy deps (tfjs-node, model files). Stub detectors unblock immediately.

**The Scientific Proof**: Build + 1506 tests pass with stubs injected. `computeVideoQualityGrade` returns "good" when capabilities are `{ face: true, pose: true }`. For upload pipeline, `SessionManager.deps` is private — can't access pipeline from the handler. Direct dep injection in `index.ts` is cleaner than exposing internals.

**The Farley Principle Applied**: Evolutionary Architecture — keep the system green and releasable at every step. Stub → real ML is a clean swap. Direct dep injection follows the Dependency Inversion Principle.

**The Resulting Rule**: When a pipeline component requires heavy deps (ML models, native bindings), start with a stub that satisfies the interface contract. Use direct constructor injection for cross-cutting pipeline access instead of exposing internals.

**Future Warning**: When implementing real ML detectors (#27), ensure they satisfy the same interface (`detect(buffer, w, h) → Detection|null`). The factory closure in `index.ts` will automatically use real detectors when they replace the stubs.

## 🗓️ 2026-02-25 — Lesson 08: Never Hardcode Version in Tests

**The Discovery**: `index.test.ts` asserted `APP_VERSION === "0.1.0"` which broke when the version was bumped to 0.4.0. The test was validating a stale constant, not the versioning plumbing.

**The Scientific Proof**: Test failure: `expected '0.4.0' to be '0.1.0'`. After reading `package.json` dynamically in the test and asserting `APP_VERSION === pkg.version`, the test validates the plumbing without coupling to a specific version string.

**The Farley Principle Applied**: Tests should verify behavior and contracts, not implementation details. A version string is a configuration value, not a behavioral contract.

**The Resulting Rule**: When testing exported configuration values (version, app name, etc.), validate them against the authoritative source (e.g., `package.json`) rather than hardcoding expected values.

**Future Warning**: Any test that asserts a specific version string will break on the next version bump. Search for `toBe("0.` patterns in test files.

## 🗓️ 2026-02-25 — Lesson 07: Unicode in CSS Comments Breaks Text-Matching Tools

**The Discovery**: CSS files with box-drawing characters (─) in comment headers cause exact-string-matching tools to fail because the tool representation encodes them differently than the file contains.

**The Scientific Proof**: `replace_file_content` tool repeatedly failed to match CSS comment lines containing `─── Reset & Base ───`. `cat -v` confirmed the characters were multi-byte Unicode (`M-^TM-^@`). Using `sed` with line-number ranges succeeded.

**The Farley Principle Applied**: Tools have assumptions. When a tool fails silently, investigate the encoding boundary before retrying the same approach.

**The Resulting Rule**: When editing files with Unicode decorative characters (box-drawing, emoji, CJK), use line-number-based tools (`sed '13,1041d'`) instead of content-matching tools.

**Future Warning**: New CSS files should use ASCII-safe comment dividers (`/* --- */`) to avoid this friction.

## 🗓️ 2026-02-25 — Lesson 06: CSS Variable Names Matter for Migration

**The Discovery**: When renaming CSS custom properties (e.g., `--color-text-muted` → `--text-muted`), three inline style references in the JavaScript (`style.color = "var(--color-text-muted)"`) were missed on the first pass.

**The Scientific Proof**: `grep -n 'color-text-muted' index.html` found 3 JS references at lines 1527, 1549, and 1566 that would have silently failed (CSS variables fall back to `initial` when undefined).

**The Farley Principle Applied**: Rename operations must cover all consumers, not just the definition site. CSS variable renames are especially dangerous because failures are silent (no build error, no runtime error).

**The Resulting Rule**: After renaming CSS custom properties, grep the entire codebase (including JS, HTML, and template files) for both the old and new names. Pay special attention to inline `style.*` assignments in JavaScript.

**Future Warning**: CSS-in-JS references to CSS custom properties won't be caught by CSS linters. Always grep.

## 🗓️ 2026-02-25 — Lesson 05: CSS Extraction Reduces index.html by ~30%

**The Discovery**: Moving 1060 lines of inline CSS to an external `style.css` file reduced `index.html` from 3894 to 2851 lines, improving maintainability and enabling independent caching.

**The Scientific Proof**: `wc -l` before (3894) and after (2851). All 1506 backend tests pass. The external stylesheet loads correctly via `<link>`.

**The Farley Principle Applied**: Separation of Concerns — structure (HTML), presentation (CSS), and behavior (JS) should be in separate files when complexity warrants it.

**The Resulting Rule**: For single-file frontends exceeding ~500 lines of inline CSS, extract to an external stylesheet. The caching and maintainability benefits outweigh the HTTP request cost.

**Future Warning**: The `index.html` still has ~1800 lines of inline JS. Consider extracting to `app.js` if the JS grows further.

## 🗓️ 2026-02-25 — Lesson 04: Always Check Footer/Version Indicators

**The Discovery**: The footer said "Phase 2" despite Phase 4 being fully implemented. These cosmetic details erode user confidence in the accuracy of the system.

**The Scientific Proof**: Visual inspection of the running app confirmed the footer was 2 phases behind the actual codebase state.

**The Farley Principle Applied**: Attention to Detail — user-facing metadata must reflect reality. Stale indicators suggest stale code.

**The Resulting Rule**: After completing a phase or major milestone, audit all user-facing version/phase indicators (footer, about page, splash screen, README badges).

**Future Warning**: The footer now dynamically fetches from `/api/version`, so it will stay in sync with `package.json` automatically.

## 🗓️ 2026-02-25 — Lesson 03: Property-Based Testing is Highly Effective

**The Discovery**: 1506 tests across 43 files with extensive fast-check property tests caught edge cases in video processing (frame gaps, resolution changes, temporal integrity) that unit tests alone would miss.

**The Scientific Proof**: The property tests exercise thousands of random inputs per test case, covering edge cases like zero-length frames, maximum timestamps, and boundary conditions that manual test case selection would miss.

**The Farley Principle Applied**: Scientific Rigor — property-based tests are hypothesis tests. They state an invariant ("for all valid inputs, output satisfies property P") and attempt to falsify it.

**The Resulting Rule**: New pipeline components (processors, extractors, analyzers) should have property-based tests alongside unit tests. Use fast-check for input generation.

**Future Warning**: Property tests are slower than unit tests. Keep the `numRuns` parameter reasonable (default 100) to avoid test suite slowdown.

## 🗓️ 2026-02-25 — Lesson 02: video_stream_ready Must Include Dimensions

**The Discovery**: The `video_stream_ready` client message omitted `width` and `height` fields, even though the server-side `VideoProcessor` needed them for frame sizing and quality grading.

**The Scientific Proof**: The `ClientMessage` type definition for `video_stream_ready` includes `width` and `height` as required fields. The frontend code had access to `videoTrack.getSettings()` but wasn't extracting these values.

**The Farley Principle Applied**: Contract-First — the type system defines the contract. Client code must satisfy all required fields, not just the ones that happen to work without them.

**The Resulting Rule**: When sending structured messages to a server, verify that all required fields in the message type are populated. TypeScript only catches this at compile time if the client-side types are aligned.

**Future Warning**: Adding new fields to `ClientMessage` types requires updating both the TypeScript types AND the inline JS in `index.html` (which doesn't have type checking).

## 🗓️ 2026-02-25 — Lesson 01: Baseline Tests Before Any Changes

**The Discovery**: Running the full test suite (`npx vitest run`) as the first action established that all 1506 tests passed, providing a reliable baseline to detect regressions from subsequent changes.

**The Scientific Proof**: Every change was followed by a full test suite run, confirming 1506/1506 pass. Any regression would be immediately attributable to the most recent change.

**The Farley Principle Applied**: Baseline Protocol — the manifesto requires running existing tests first to establish a "Truth" state.

**The Resulting Rule**: Always run the full test suite before making changes in a new codebase. The baseline count becomes the regression target.

**Future Warning**: The test count (1506) should only increase. A decrease indicates deleted tests, which requires justification.
