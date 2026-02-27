# ⚡ Engineering Rules

<!-- Read this COMPLETELY before every task. Keep it under 60 seconds to read. -->
<!-- When you add a lesson to lessons.md, update this file if it changes a rule. -->
<!-- Ordered by blast radius: most dangerous mistakes first. -->

---

## 🔴 Never Do These

**R1 — Never bypass failing tests.**
`--no-verify`, `--skip-tests`, commenting out assertions, or pinning expectations to match a bug are all forbidden. If pre-existing tests are red, fix them before adding new code. *(Lesson 01)*

**R2 — Never hardcode version strings in tests.**
Assert against the authoritative source (`package.json`) not a literal like `"0.1.0"`. Every version bump will break hardcoded assertions. Pattern to grep for: `toBe("0.`. *(Lesson 08)*

**R3 — Never use content-matching tools on files with Unicode decorative characters.**
Box-drawing (`─`), emoji, and CJK characters cause exact-string tools to fail silently. Use line-number-based operations (`sed '13,1041d'`) instead. New files should use ASCII-safe dividers (`/* --- */`). *(Lesson 07)*

---

## 🟡 Always Do These Before Starting

**R4 — Run the full test suite to establish a baseline before any changes.**
`npx vitest run` — note the passing count (currently 1506+). A decrease requires justification. *(Lesson 01)*

**R5 — Read the last 5 entries in lessons.md before starting any task.**
`tail -n 120 tasks/lessons.md`

**R6 — After renaming CSS custom properties, grep the entire codebase.**
CSS variable renames fail silently (no build error, no runtime error). Grep for both old and new names across HTML, JS, and inline `style.*` assignments. *(Lesson 06)*

**R7 — After completing a phase/milestone, audit all user-facing indicators.**
Footer, about page, splash screen, README badges — stale metadata ("Phase 2" when you're on Phase 4) erodes user confidence. *(Lesson 04)*

---

## 🟢 Architecture Patterns That Are Proven Here

**R8 — Use stub implementations for heavy deps (ML models, native bindings).**
Start with a stub satisfying the interface contract (`detect(buffer, w, h) → Detection|null`). Use direct constructor injection for cross-cutting pipeline access. Stub → real is a clean swap. *(Lesson 09)*

**R9 — New pipeline components must have property-based tests alongside unit tests.**
Use fast-check for input generation. Keep `numRuns` reasonable (default 100) to avoid slowdown. Property tests catch edge cases (zero-length frames, resolution boundaries) that manual cases miss. *(Lesson 03)*

**R10 — When inline CSS exceeds ~500 lines, extract to an external stylesheet.**
Caching and maintainability benefits outweigh the HTTP request cost. Same applies to inline JS once it grows. *(Lesson 05)*

**R11 — Client messages must populate all required type fields.**
`video_stream_ready` must include `width` and `height`. TypeScript catches this at compile time only if client-side types are aligned; inline JS in `index.html` has no type checking. *(Lesson 02)*

---

## ⚠️ Active Tripwires

- `index.html` still has ~1800 lines of inline JS. Extract to `app.js` if it grows further. *(Lesson 05)*
- Adding fields to `ClientMessage` types requires updating both TypeScript types AND the untyped inline JS in `index.html`. *(Lesson 02)*
- Real ML detector implementation (#27) must satisfy the stub interface: `detect(buffer, w, h) → Detection|null`. The factory closure in `index.ts` auto-uses real detectors when stubs are replaced. *(Lesson 09)*
