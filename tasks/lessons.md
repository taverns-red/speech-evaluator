# 📚 Lessons Learned

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
<!-- **Future Warning**: [What to watch for — a tripwire for the agent]                    -->## 🗓️ 2026-03-21 — Lesson 55: WebSocket Reconnect Loses All Session State

**The Discovery**: User reported iPhone recording failure (#165). Root cause: when the WS drops (Cloud Run idle timeout) and reconnects, the server creates a fresh session with no consent. The `onopen` handler only sent `audio_format` — never consent or other config. The server then rejected `start_recording` with "consent not confirmed" even though the client showed consent as confirmed.

**The Resulting Rule**: Every persistent client-side config message (consent, video, project context, analysis tier, evaluation style, VAD, time limit, notes) must be replayed on `ws.onopen` via `resyncSessionState()`. When adding new config messages in the future, add them to the resync function too.

**Future Warning**: If adding a new `set_*` WebSocket config message, remember to add it to `resyncSessionState()` in `websocket.js` or the same issue will recur.

## 🗓️ 2026-03-21 — Lesson 54: Pure Modules Enable Parallel Feature Development

**The Discovery**: Sprint C20 shipped 3 features (operator notes, Markdown export, shareable links) in rapid succession with 29 new tests and 0 regressions. The key enabler was extracting logic into pure function modules (`markdown-export.ts`, `share-token.ts`) that are tested independently of the server, then wiring them into `server.ts` via dynamic `import()`. This pattern avoids circular deps and keeps blast radius minimal.

**The Resulting Rule**: For new output formats or token generators, create pure `.ts` modules with no server dependencies. Test them with unit tests first, then wire them into server.ts as a separate commit.

**Future Warning**: The share index (`shares/<token>.json` in GCS) grows indefinitely. If share links ever need expiry, add a `expiresAt` field to the index JSON and a scheduled cleanup job.

## 🗓️ 2026-03-21 — Lesson 53: Clerk Development Instances Cannot Use Custom Domains

**The Discovery**: Clerk's development instances (`pk_test_` keys) do not support Allowed Subdomains, Satellites, or proxy configuration — all require a production instance. Bot protection (Turnstile) also fails on custom domains in dev mode because the Turnstile widget can't initialize outside Clerk's `accounts.dev` domain. Sign-in works, but sign-up triggers bot protection and fails with "Unable to complete action."

**The Resulting Rule**: For Clerk dev mode, either disable bot protection in the Clerk Dashboard (Attack Protection → None) or test on the raw Cloud Run URL. For production, switch to `pk_live_`/`sk_live_` keys and set up the 5 CNAME records for the custom domain.

**Future Warning**: When switching to production Clerk keys, you'll need DNS records (clerk.eval, accounts.eval, clkmail.eval, + 2 DKIM records) pointing to `*.clerk.services`. The proxy configuration is only available on production instances.

## 🗓️ 2026-03-21 — Lesson 52: Pin GitHub Actions by SHA or Verified Tag — Supply Chain Attacks Are Real

**The Discovery**: While updating `aquasecurity/trivy-action` from `@master` to a tagged version, research revealed that tags `0.0.1`–`0.34.2` were compromised in a supply chain attack (Feb-Mar 2026). Attackers force-pushed malicious info-stealer code to 75 of 76 version tags. Only `0.35.0` was clean.

**The Resulting Rule**: Never float GitHub Actions on `@master` or `@main`. Pin to verified tags (`@0.35.0`) or commit SHAs. When updating an action, always check the repo's security advisories and recent release notes before choosing a version.

**Future Warning**: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` is a stopgap. Once Node.js 24 becomes the GitHub Actions default (June 2026), remove this env var to avoid confusion.

## 🗓️ 2026-03-21 — Lesson 50: Deepgram Diarization — Use Mode for Segment-Level Speaker

**The Discovery**: Deepgram's `diarize: true` adds a `speaker` integer to each word, but segments span multiple words that may have different speaker labels (e.g., at speaker transitions). Computing the segment-level speaker as the statistical mode of its word speakers produces the most intuitive result, gracefully handling boundary segments.

**The Resulting Rule**: When aggregating per-word labels to a segment level, use mode (most frequent value) rather than first-word or last-word. This handles edge cases like mid-segment speaker switches while maintaining a clean API for the frontend.

**Future Warning**: The `speaker` field is `undefined` on all words when diarization isn't supported (e.g., mono audio with a single speaker). Always use conditional spreading (`...(w.speaker !== undefined ? { speakerId: w.speaker } : {})`) to keep the field absent rather than setting it to `null`.

## 🗓️ 2026-03-21 — Lesson 51: Auth SDK Migration — Keep the Interface, Replace the Engine

**The Discovery**: Migrating from Firebase Auth to Clerk was clean because the middleware surface area was already well-defined: `createAuthMiddleware(options)` and `verifyAndAuthorize(token, ...)`. Only the engine internals changed (Firebase `verifyIdToken` → Clerk `clerkMiddleware` + `getAuth`). The `req.user` shape, public paths, allowlist logic, and access-denied HTML were all reused verbatim.

**The Resulting Rule**: When swapping authentication providers, design the auth middleware with a provider-agnostic interface. Keep the public contract (`req.user`, `verifyAndAuthorize` return type) stable and only change the internal verification call. This enabled a 1-file migration with 0 changes to consumers.

**Future Warning**: Clerk session claims require custom configuration in the Clerk dashboard to include `email`, `name`, and `picture`. Without this, `sessionClaims.email` will be `undefined` and the allowlist will reject all users.

## 🗓️ 2026-03-21 — Lesson 48: Pure-Logic Modules Enable TDD for Real-time Features

**The Discovery**: Coaching cues needed to analyze live transcript data (WPM, filler count, pause gaps) and fire notifications with cooldowns. By extracting `computeCues()` as a pure function (segments + elapsed → cue array), all 16 tests could be written without WebSocket mocks, timers, or DOM. The server just calls the function in a `setInterval` and forwards results — zero logic in the wiring layer.

**The Resulting Rule**: When building a real-time feature that processes streaming data, extract the analysis logic into a pure function that takes snapshots of accumulated state. The integration layer (timer, WebSocket) becomes a thin adapter with no branching logic of its own.

**Future Warning**: The 10-second ticker interval means cues are delayed up to 10 seconds after the triggering event. If sub-second responsiveness is needed, move to event-driven architecture (fire on each new transcript segment).

## 🗓️ 2026-03-21 — Lesson 49: Setup Wizards Should Apply Settings via Existing Event Dispatch

**The Discovery**: The setup wizard needed to set speaker name, feedback style, and analysis tier — all of which already had `change`/`input` event listeners wired to `onAnalysisTierChange()`, `onEvaluationStyleChange()`, etc. Rather than duplicating the persistence logic, the wizard sets `radio.checked = true` and dispatches a `change` event, letting the existing handler do all the work (state update, localStorage save, WebSocket notification).

**The Resulting Rule**: When a wizard or import flow needs to configure existing form fields, dispatch DOM events against the actual form elements rather than calling state-setting functions directly. This ensures all side effects (validation, persistence, server notification) fire exactly as if the user clicked manually.

**Future Warning**: `dispatchEvent(new Event("change", { bubbles: true }))` doesn't trigger `input` events. If a form field relies on `input` events for live validation (like the speaker name field), dispatch both event types.

## 🗓️ 2026-03-21 — Lesson 44: Golden File Shape Testing Catches Frontend Contract Drift

**The Discovery**: After 8 sprints, the backend test suite had 1849 tests but none verified the JSON shape consumed by the frontend. A change to `StructuredEvaluation` (e.g., renaming `evidence_quote` → `quote`) would pass all backend tests because they only check interface compliance. The frontend would break silently because it reads `data.evidence_quote` directly. A recursive "shape verifier" that walks golden JSON files catches this: it checks that every key in the golden file exists in the actual output, and that arrays contain elements matching the golden element shape.

**The Resulting Rule**: For any JSON contract between two layers (backend → frontend, server → API consumer), create a golden file defining the expected shape and a test that verifies the actual output matches. The golden file should define structure (key names, nesting) not values. Update golden files deliberately — never auto-update, because the purpose is to catch unintentional drift.

**Future Warning**: If a new evaluation style (e.g., "star") is added, a golden file must be added simultaneously or the shape test won't cover it. Consider a meta-test that asserts `EvaluationStyle` enum values each have a corresponding golden file.

## 🗓️ 2026-03-21 — Lesson 45: Composable Prompt Addenda Enable Feature-Level LLM Expansion

**The Discovery**: Adding category scores (#144) required the LLM to produce new JSON fields alongside existing ones. Rather than editing the main system prompt (risking regression on existing evaluation quality), we created a standalone `system-category-scores.txt` addendum that the prompt loader auto-appends. This addendum only adds the `category_scores` schema and rubric — the LLM merges it into its existing JSON response naturally.

**The Resulting Rule**: When extending LLM output with a new structured field, create a separate prompt addendum file rather than modifying the main prompt. Register it in `prompt-loader.ts` with `alwaysInclude: true`. This keeps prompt evolution atomic and reversible. Each addendum owns its own schema documentation and rubric.

**Future Warning**: As addenda accumulate, total token count grows. Monitor system prompt token usage; when it exceeds ~3K tokens, consider consolidating addenda into a single prompt with feature flags.

## 🗓️ 2026-03-21 — Lesson 46: Public Accessor Beats Private Field Renaming for Cross-Module Access

**The Discovery**: The improvement plan module (#145) needed the GCS client from `GcsHistoryService`, but the client was private. Instead of making it public (breaking encapsulation) or adding a method per operation (explosion of pass-through methods), we renamed the private field to `_client` and added a public `get client()` accessor. This preserves the constructor's dependency injection pattern while allowing controlled external access for authorized consumers.

**The Resulting Rule**: When an encapsulated dependency needs cross-module access, prefer a public getter over making the field itself public. This maintains the option to add validation or logging in the accessor later.

## 🗓️ 2026-03-21 — Lesson 43: Inline SVG Sparklines Beat Chart Libraries for Simple Trends

**The Discovery**: The progress chart needed to show WPM, pass rate, and filler rate trends across speeches. Instead of pulling in Chart.js (250KB+ min) or D3 (280KB+), a simple `<svg>` with `<polyline>` and `<circle>` generates the same sparkline in ~15 lines of JS. The trick: normalize values to the SVG viewBox, compute x from step width and y from `(value - min) / range * plotHeight`. A dot on the last point completes the effect.

**The Resulting Rule**: For trend lines and sparklines (up to ~50 points, single metric), inline SVG is always preferable to a chart library. Reserve libraries for interactive charts (zoom, tooltip, brushing) or multi-axis composite views. The breakpoint is roughly: sparkline = SVG, dashboard = library.

**Future Warning**: When all values are identical (flat line), `range = 0` which produces NaN coordinates. Guard with `range = max - min || 1` to default to a centered flat line.

## 🗓️ 2026-03-21 — Lesson 42: WebSocket Reconnect Requires Guard Flags to Prevent Cascading Drops

**The Discovery**: When adding auto-reconnect to the Deepgram WS, the existing single-mock test pattern (same `mockLiveClient` for all `listen.live()` calls) caused cascading Close events — each reconnection's new handlers were attached to the same object as the old ones. The reconnection loop appeared to succeed but then immediately re-dropped. The fix required two flags: `_reconnecting` (prevents re-entrant `handleUnexpectedDrop`) and `_stopped` (prevents reconnection after intentional `stopLive()`). Tests that need reconnection to *fail* must override `listen.live` to throw after the first call.

**The Resulting Rule**: Any reconnecting WebSocket must have: (1) a `_reconnecting` guard to prevent re-entrant drop handlers, (2) a `_stopped` flag set in the intentional-close path to suppress post-close reconnection, (3) tests that explicitly control whether reconnection succeeds or fails by overriding the connection factory. Never rely on the same mock object being reused — create fresh instances per connection attempt.

**Future Warning**: If the reconnection loop's `openLiveConnection()` succeeds but the *new* connection drops immediately, the `_reconnecting` flag is already false (set to false on success), so `handleUnexpectedDrop` re-fires. This is correct behavior (retry on new drop), but with a shared mock it cascades. Always use `createReconnectableMockClient()` for reconnection tests to get distinct client instances.

## 🗓️ 2026-03-21 — Lesson 41: Native details/summary for Config Section Collapse

**The Discovery**: The consent form grew to 7 sections over C1-C5, pushing the Start Speech button ~4 screen-heights below the fold. Rather than building a custom accordion or React component, native `<details>`/`<summary>` HTML elements provide zero-JS collapse behavior that works on all modern browsers, including mobile Safari.

**The Resulting Rule**: When a form grows beyond 2-3 sections, wrap optional/advanced config in `<details>` with `<summary>` showing the current setting value. Keep essential inputs (consent, identity) always visible. Combine with a `sticky` action bar so the primary CTA is never hidden. This gives 80% of a setup wizard's benefit at 5% of the cost.

**Future Warning**: `<details>` has no open/close animation by default. If the snap-open feels jarring, add a CSS `max-height` transition on the inner `.config-body`. Also, `<details>` elements can't be programmatically controlled via `display:none` on their children — you must target the `<details>` element itself for show/hide (as done for `config-roles`).

## 🗓️ 2026-03-20 — Lesson 39: Retention Sweep as a Lightweight Alternative to GCS Lifecycle

**The Discovery**: GCS lifecycle policies require bucket-level admin access and operate on object age (creation time), not on metadata fields. Since evaluation age should be based on the `date` field in `metadata.json` (when the speech was evaluated), a lightweight application-level sweep is more accurate and doesn't require IAM changes.

**The Resulting Rule**: For metadata-aware retention policies, prefer an application-level sweep over cloud-provider lifecycle rules. Schedule it with `setInterval` (daily), run initial sweep 30s post-startup (non-blocking), and make TTL configurable via env vars. The sweep iterates `results/{speaker}/{eval}/metadata.json`, parses dates, and calls `deletePrefix()` for expired entries.

**Future Warning**: If the number of evaluations grows large (>10K), the sweep's `listPrefixes` + `readFile` pattern will become expensive. At that scale, consider adding a `createdAt` custom metadata header to GCS objects and using native lifecycle policies instead.

## 🗓️ 2026-03-20 — Lesson 38: Parallel Frame Capture for Different Consumers

**The Discovery**: The system already had a 5fps binary frame capture (TM-prefixed wire format) for Phase 4 ML processing (face/gaze/gesture detection). Vision tiers (GPT-4o) need much lower-frequency captures (1-10s intervals) sent as JSON data URIs. These are fundamentally different consumers: ML wants high-frequency raw frames, LLM wants low-frequency base64 for prompt content parts.

**The Scientific Proof**: Attempting to reuse the existing 5fps capture would either overwhelm the LLM with too many frames (hitting maxFrames instantly) or require complex filtering logic. Separate `startVisionCapture()` / `stopVisionCapture()` functions run independently from the ML capture with their own interval timers and frame buffers.

**The Resulting Rule**: When two consumers want the same data (video frames) at different frequencies and in different formats, implement parallel capture paths rather than trying to multiplex one stream. The shared resource (canvas element, video stream) can be safely reused since canvas snapshot is synchronous.

**Future Warning**: If a third consumer emerges (e.g., thumbnail capture for UI), evaluate whether it's another parallel path or if a generic "capture at N fps, distribute to subscribers" pattern is warranted.

## 🗓️ 2026-03-20 — Lesson 37: Multimodal LLM Prompts via Content Parts

**The Discovery**: When adding GPT-4o Vision support to the evaluation generator, the `callLLM` method needed to switch between text-only prompts (standard tier) and multipart content with `image_url` parts (vision tiers). The OpenAI API accepts either a string or an array of content parts for the `content` field. The key insight is that text-only and multimodal prompts share the same system prompt — only the user message changes shape.

**The Resulting Rule**: When adding multimodal support to an existing text-only LLM call, keep the system prompt unchanged and conditionally construct the user content. Read frames from disk as base64 data URIs (`data:image/jpeg;base64,...`) rather than uploading to a URL. This keeps the change isolated to the `callLLM` method.

**Future Warning**: When using `image_url` content parts with `detail: "low"`, each image costs ~85 tokens. At Maximum tier (1 frame/sec, 20-min speech), that's ~102,000 tokens from images alone. Always enforce `maxFrames` caps.

## 🗓️ 2026-03-21 — Lesson 40: Full-Stack Feature Threading Pattern

**The Discovery**: Adding `evaluationStyle` as a configurable option required changes across 12 files in a predictable order: types.ts (enum + interfaces) → prompt partials → prompt-loader → evaluation-generator → frontend HTML → frontend JS (state/consent/app/upload) → server WebSocket handler → session-manager evalConfig builds → upload-handler. Each layer had minimal blast radius because the pattern follows existing precedents (like `analysisTier`).

**The Resulting Rule**: When adding a new configurable option to the speech evaluator, follow the "analysisTier pattern": types → prompts → generator → frontend → server → session-manager → upload-handler. The ProjectContext interface carries per-speech settings from WebSocket to evalConfig naturally, avoiding the need for a new session-manager method.

**Future Warning**: When `evaluationStyle` is stored on `ProjectContext` (which accepts `string`), but `EvaluationConfig` expects the `EvaluationStyle` enum, a cast is needed (`as EvaluationStyle`). This is safe for known enum values but could silently pass invalid strings from unvalidated WebSocket input. Consider adding server-side validation of the style value.

## 🗓️ 2026-03-20 — Lesson 36: DI via Client Interface for GCS Testability

**The Discovery**: When building `GcsHistoryService`, rather than mocking `@google-cloud/storage` directly (brittle, tightly coupled to SDK internals), defining a thin `GcsHistoryClient` interface with `saveFile/listPrefixes/readFile/getSignedReadUrl/fileExists` allowed the entire service to be tested with simple `vi.fn()` mocks — 26 tests, zero SDK coupling. The real `createGcsHistoryClient()` factory wraps the SDK into that interface.

**The Resulting Rule**: For external service integrations (GCS, Deepgram, OpenAI), always define a minimal client interface at the service boundary. Test the business logic against the interface, not the SDK. The factory function is the only place that touches the SDK.

**Future Warning**: If you find yourself importing `@google-cloud/storage` in a test file, you're testing the wrong thing. Mock the interface, not the SDK.

## 🗓️ 2026-03-19 — Lesson 35: Verify Runtime State, Not Source Comments

**The Discovery**: Issue #27 (ML detector stubs) appeared open and multiple source-level signals suggested the detectors were unimplemented: Lesson 9 mentioned "stub detectors", AGENTS.md listed "stubs", `video-processor.ts` had 12 stale STUB comments/docstrings, and `index.ts` imported both `StubFaceDetector` and `TfjsFaceDetector`. All signals pointed to incomplete implementation. But checking Cloud Run production logs revealed `"BlazeFace loaded"` and `"MoveNet Lightning loaded"` — real detectors were running. The stubs were fallback-only code that never activates.

**The Scientific Proof**: `gcloud logging read` for the service showed real models loading. The entire VideoProcessor (1617 LoC) was fully implemented with gaze classification, gesture detection, body stability, facial energy.

**The Resulting Rule**: When assessing feature completeness, verify the actual runtime behavior (logs, deployed state) before trusting source-level comments, issue titles, or documentation. Comments rot faster than code. Production logs are the source of truth.

**Future Warning**: If source comments say "stub" but the code block below the comment has a full implementation, the comment is stale. Clean them up immediately — they will mislead future developers and agents.

## 🗓️ 2026-03-15 — Lesson 34: DOM Cache Key Names Must Match Usage Sites During State Extraction

**The Discovery**: When extracting shared state into `state.js`, the `dom` cache renamed `videoFpsConfig` to `videoFpsConfig_el` (to disambiguate from `S.videoFpsConfig`, the numeric FPS value). But `app.js` still referenced `dom.videoFpsConfig` (no `_el` suffix) in 5 locations. Since `dom.videoFpsConfig` was `undefined`, calling `hide(undefined)` threw `TypeError: Cannot read properties of undefined (reading 'classList')`. This crashed the entire module before the Module→Global Bridge could execute, making ALL other functions fail with `ReferenceError`.

**The Scientific Proof**: Browser console showed `TypeError: Cannot read properties of undefined (reading 'classList')` at `hide(utils.js:22)` called from `updateUI(app.js:221)`. Renaming all 5 references to `dom.videoFpsConfig_el` fixed the crash and all downstream errors.

**The Resulting Rule**: When renaming keys in a shared object (like a DOM cache), grep for ALL usage sites of the old name. A naming disambiguation (`_el` suffix) is worthless if consumers aren't updated. Use `grep -rn 'dom\.oldName' public/js/` before committing.

**Future Warning**: Any new DOM cache entries that share a name with an `S.*` state variable need the `_el` suffix convention — and ALL consumers must use the suffixed name.

**rules.md**: none (project-specific naming convention)

## 🗓️ 2026-03-14 — Lesson 33: ES Module Scoping Breaks Inline onclick Handlers

**The Discovery**: New functions (`switchMode`, `onExportPDF`) defined inside `<script type="module">` were invisible to inline HTML `onclick` attributes. The existing codebase already had a "Module → Global Bridge" section at the bottom of the script that explicitly assigns `window.functionName = functionName` for every onclick-referenced function. Adding new functions without registering them in this bridge means they silently fail when clicked.

**The Scientific Proof**: Browser console showed `ReferenceError: switchMode is not defined` when clicking the mode tabs. Adding `window.switchMode = switchMode` to the bridge fixed it immediately.

**The Resulting Rule**: Every function referenced by an inline HTML `onclick`/`onchange` attribute in a `<script type="module">` MUST be registered in the Module → Global Bridge. Also prefer `addEventListener` over inline handlers when practical.

## 🗓️ 2026-03-14 — Lesson 32: Injectable LLM Functions Enable Role Testability

**The Discovery**: The Grammarian role needed LLM access, but directly depending on `EvaluationGenerator` or `OpenAI` would make testing require complex mocks. By accepting a generic `llmCall: (prompt: string) => Promise<string>` via `RoleContext.config`, the role becomes trivially testable with `vi.fn().mockResolvedValue(...)` while the server wires in the real OpenAI call at runtime.

**The Scientific Proof**: 17 Grammarian tests run in <10ms using mock LLM functions. LLM failure fallback tested with `mockRejectedValue` and invalid JSON responses.

**The Resulting Rule**: LLM-dependent roles should accept a simple function signature rather than a concrete client class. This follows dependency inversion and enables fast unit tests.

**Future Warning**: The `config` bag is loosely typed (`Record<string, unknown>`). Consider adding a `LLMRoleConfig` interface if more roles need this pattern.

## 🗓️ 2026-03-14 — Lesson 31: Standalone Functions Don't Capture Closure Variables

**The Discovery**: When threading a new dependency (`roleRegistry`) through the WebSocket message handling chain in `server.ts`, the build failed because `handleClientMessage` and `handleDeliverEvaluation` are standalone functions — not closures — so they don't capture variables from `createAppServer`. Every standalone function in the call chain must explicitly receive the dependency as a parameter.

**The Scientific Proof**: TypeScript build error `TS2552: Cannot find name 'roleRegistry'` at 3 call sites. Fixed by adding `roleRegistry` parameter to `handleConnection` → `handleClientMessage` → `handleDeliverEvaluation`.

**The Resulting Rule**: When adding a dependency to deeply nested handlers, trace the full call chain and add the parameter to every standalone function. Don't assume closure capture.

## 🗓️ 2026-03-14 — Lesson 30: OpenAI Whisper 25MB Limit Includes Multipart Encoding Overhead

**The Discovery**: The `TranscriptionEngine.finalizeChunked()` method calculated `MAX_CHUNK_BYTES` as `25 * 1024 * 1024 - 44` (25MB minus WAV header). But the OpenAI Whisper API measures the *total HTTP request body*, which includes multipart boundary strings, Content-Type headers, and the WAV header. A chunk that's exactly 25MB as a WAV file pushes the HTTP body ~893 bytes over the limit, causing a 413 error.

**The Scientific Proof**: Cloud Run logs showed: `Process error: 413 413: Maximum content size limit (26214400) exceeded (26215293 bytes read)` — the 893-byte overshoot matches multipart encoding overhead.

**The Resulting Rule**: When chunking for API file size limits, use a 1MB safety margin (e.g., 24MB for a 25MB limit). Never calculate exact-boundary values.

**Future Warning**: Any API with a file size limit requires a safety margin for HTTP encoding overhead. The margin scales with metadata size.

## 🗓️ 2026-03-14 — Lesson 29: fast-check Requires asyncProperty for async Predicates

**The Discovery**: Using `fc.property()` with an `async` predicate function silently fails — the promise resolves to a truthy object which `fc.assert()` interprets as `true`, so violations go undetected. Property-based tests with async operations (like calling `role.run()`) must use `fc.asyncProperty()` and the `it()` callback must be `async` with `await fc.assert(...)`.

**The Scientific Proof**: 2 property tests for AhCounterRole passed falsely with `fc.property()` + async predicates. Switching to `fc.asyncProperty()` + `await` made them properly execute assertions.

**The Resulting Rule**: Always use `fc.asyncProperty()` when the predicate is async. Search for `fc.property(` + `async` in test files to detect violations.

**Future Warning**: Any property test calling an async function (Promise-returning) must use `asyncProperty`. The synchronous `property()` will silently accept the Promise object as truthy.

## 🗓️ 2026-03-14 — Lesson 28: Error Message Format Compatibility During Module Extraction

**The Discovery**: When extracting `assertTransition()` from `SessionManager` into `session-state-machine.ts`, changing the error message format caused 13 test failures. Tests checked for specific substrings like `toContain("Expected state")` and `toContain("startRecording()")` in error messages.

**The Scientific Proof**: First build passed, but 13 tests failed on error message assertions. The fix was to format the new module's error messages identically to the old inline code, preserving the `"Expected state: \"${expectedSource}\". Current state: \"${current}\"."` structure.

**The Resulting Rule**: When extracting logic into a shared module, always match the existing error message format exactly. Search for `toContain` and `toThrowError` in test files to find message assertions before changing error text.

**Future Warning**: Any error message refactoring must grep for test assertions that match against the error text. This applies to all extractable concerns, not just state machines.

## 🗓️ 2026-03-14 — Lesson 27: validateAndRetry Drops Non-Standard Fields When Reconstructing Evaluation Objects

**The Discovery**: The `validateAndRetry()` method in `evaluation-generator.ts` reconstructs the `StructuredEvaluation` object from individual fields, but only copies known fields (`opening`, `items`, `closing`, `structure_commentary`, `visual_feedback`). When `completed_form` was added to the GPT output schema, the parser correctly extracted it, but `validateAndRetry` silently dropped it when building the return object.

**The Scientific Proof**: Debug logging confirmed GPT returned `completed_form` as a string (~4000 chars), but the `upload-handler.ts` log showed `hasForm=true` with no form returned. The field was lost between `parseEvaluation()` (which preserved it) and the final `validateAndRetry()` result.

**The Resulting Rule**: When adding new optional fields to `StructuredEvaluation`, always check `validateAndRetry()` and any other method that reconstructs the evaluation object using object spread. Add a `...(evaluation.newField ? { newField: evaluation.newField } : {})` spread for each new optional field.

**Future Warning**: Any new fields added to the evaluation schema (e.g., `rubric_scores`, `audience_feedback`) will be silently dropped unless explicitly propagated through `validateAndRetry()`.

## 🗓️ 2026-03-14 — Lesson 26: Cloud Run HTTP/1.1 Has a Fixed 32 MiB Request Body Limit

**The Discovery**: Video uploads ≥32 MiB silently fail with HTTP 413 (Payload Too Large) on Cloud Run. The error comes from Cloud Run's ingress proxy, **not** from Express/multer, so no server-side logs are generated. The 32 MiB limit is **fixed and cannot be overridden** for HTTP/1.1 connections. Using `--use-http2` would lift this limit but is explicitly incompatible with WebSocket session affinity.

**The Scientific Proof**: Browser test (`upload_test` recording) confirmed a 1.3 GB .mov file triggered a 413 response. Server logs showed zero POST requests — the rejection happened at the ingress proxy layer. Google Cloud documentation confirms the 32 MiB fixed limit for HTTP/1.1.

**The Resulting Rule**: Always keep `MAX_UPLOAD_SIZE_MB` **≤ 32** in both client and server when deploying to Cloud Run over HTTP/1.1. For larger files, implement Cloud Storage signed URL uploads or client-side compression. Always add explicit 413 error handling in the client.

**Future Warning**: If the app ever needs to support files > 32 MB, the architecture must change to either (a) use GCS signed URLs for direct upload, or (b) implement client-side video compression before upload.

## 🗓️ 2026-03-14 — Lesson 25: MediaRecorder MIME Type Detection Is Browser-Specific

**The Discovery**: `MediaRecorder.isTypeSupported()` returns different results across browsers. Chrome supports `audio/webm;codecs=opus`, Safari supports `audio/mp4`, Firefox supports `audio/ogg;codecs=opus`. A cascading fallback (`webm/opus` → `webm` → browser default) ensures cross-browser compatibility.

**The Resulting Rule**: Always use `isTypeSupported()` before specifying a MIME type, and handle the empty-string fallback (browser picks). Also, `downloadOutputsAsZip()` became async due to `FileReader.readAsDataURL()` for blob→base64 conversion — the ZIP download now uses a callback pattern (`finishZipDownload`).

**rules.md**: none

## 🗓️ 2026-03-14 — Lesson 24: gpt-4o-transcribe Returns Text-Only — No Segments, Words, or Duration

**The Discovery**: `gpt-4o-transcribe` with `response_format: "json"` returns only `{ text: "..." }` — no `segments`, `words`, or `duration` fields. The `parseTranscriptionResponse()` fallback created a single segment with `endTime: 0` (since `duration` was `undefined`), causing WPM = 0 for all uploaded videos. The bug was silent — no errors, no warnings, just degraded output.

**The Scientific Proof**: OpenAI API docs confirm `gpt-4o-transcribe` doesn't support `verbose_json` or `timestamp_granularities`. Only `whisper-1` returns word/segment timestamps. Added 3 unit tests proving the fix (model override + chunking), all pass.

**The Farley Principle Applied**: Different API models with the same endpoint can return structurally different responses. Always verify the response shape per model, not per endpoint.

**The Resulting Rule**: For transcription requiring temporal data (segments, words, duration), use `whisper-1` with `response_format: "verbose_json"` and `timestamp_granularities: ["word", "segment"]`. `gpt-4o-transcribe` is only suitable when raw text is sufficient.

**Future Warning**: `whisper-1` has a 25MB file limit. Long recordings need chunking with timestamp offsets. The `finalizeChunked()` method handles this but chunk boundaries may split words mid-sentence.

**rules.md**: none (API-specific)

## 🗓️ 2026-03-14 — Lesson 23: Multer Middleware Errors Escape to Express Default 500 Handler

**The Discovery**: When `uploadMiddleware.single("file")` is passed as Express middleware in `router.post("/", ..., uploadMiddleware.single("file"), handler)`, errors thrown by multer (e.g., `LIMIT_FILE_SIZE`) are passed to Express's `next()` callback, bypassing the route handler's `try/catch` entirely. Express's default error handler returns HTTP 500 with no JSON body. The client receives a generic 500 and the browser's `fetch().json()` throws "The string did not match the expected pattern" because the body isn't valid JSON.

**The Scientific Proof**: Server logs showed `MulterError: File too large` stack trace (not caught by route handler), HTTP 500 returned. Client console showed `ReferenceError: Can't find variable: showNotification` at line 2781 (a secondary bug masking the real error). The upload never even reached the route handler.

**The Resulting Rule**: Wrap multer invocation inside the route handler using `await new Promise((resolve, reject) => { multerMiddleware(req, res, (err) => err ? reject(err) : resolve()); })`. This keeps multer errors within the handler's control, allowing proper HTTP status codes (413 for file-too-large, 415 for unsupported type).

**rules.md**: none (Express middleware pattern)
## 🗓️ 2026-03-14 — Lesson 22: Cloud Run Container Disk is Ephemeral — Never Rely on It for User Data

**The Discovery**: `FilePersistence.saveSession()` wrote evaluation outputs (transcript, metrics, evaluation, audio) to the container's `output/` directory. Users clicked "Save Outputs" and got a confirmation message, but the files were invisible and lost on the next deploy, scale event, or container restart. The user's latest evaluation was irrecoverably deleted when we deployed the timeout fix (#53).

**The Scientific Proof**: After deploying commit `969dfa2` (Cloud Run timeout fix), the user reported their saved evaluation was gone. Cloud Run documentation confirms: container filesystem is in-memory tmpfs, cleared on every new instance.

**The Resulting Rule**: Any "save" operation on Cloud Run must deliver data to the client (download, email, external storage), not to the container's local filesystem. Server-side disk persistence is acceptable only as a secondary/debug mechanism, never as the primary user-facing path. For this app: serialize files in the WebSocket `outputs_saved` response and trigger a client-side ZIP download.

**rules.md**: none (infrastructure pattern)

## 🗓️ 2026-03-14 — Lesson 21: Cloud Run timeoutSeconds Applies to WebSocket Upgrade Requests

**The Discovery**: Cloud Run's `timeoutSeconds` (default 300s = 5 minutes) applies to the HTTP upgrade request that initiates a WebSocket connection. Once the timeout elapses, the entire WebSocket connection is silently killed — no error, no close frame, no server-side log. The client sees a sudden `onclose` event.

**The Scientific Proof**: Session `f9b93122` opened its WebSocket at 16:32:49 UTC and was killed at 16:37:50 UTC — exactly 301 seconds, 1 second over the 300s limit. Zero errors were logged between recording start (16:33:29) and WebSocket close. The deploy workflow (`ci.yml`) did not set `--timeout`, inheriting the 300s default.

**The Farley Principle Applied**: Silent infrastructure failures are the hardest to debug. The symptom ("Audio playback failed") was 3 layers removed from the root cause (Cloud Run timeout → WebSocket close → client-side TTS fail-safe). Always check infrastructure limits when connections die without errors.

**The Resulting Rule**: For Cloud Run services using WebSockets, always set `--timeout=3600` (maximum) in the deploy command. The timeout applies to the upgrade request lifetime, not individual messages. Document the expected session duration and verify the timeout accommodates it.

**Future Warning**: If sessions need to exceed 60 minutes, Cloud Run WebSocket connections will need a reconnection strategy (e.g., periodic client-side reconnects before the timeout elapses, with session resumption on the server).

**rules.md**: none (GCP-specific)

## 🗓️ 2026-02-28 — Lesson 20: Use `ideal` Not `exact` for facingMode on Mobile Cameras

**The Discovery**: `getUserMedia({ video: { facingMode: { exact: "environment" } } })` throws `OverconstrainedError` on devices that can't match the constraint exactly (e.g., desktop with a single webcam). Using `{ ideal: "environment" }` allows the browser to fall back gracefully to the available camera.

**The Scientific Proof**: The `ideal` constraint is documented in the W3C Media Capture spec as "preferentially selecting a value closest to the ideal." Combined with `enumerateDevices()` to detect multiple cameras, the flip button is only shown when switching is possible, while `ideal` prevents hard failures.

**The Farley Principle Applied**: Graceful degradation — don't gate on hardware capabilities that vary across devices. Let the constraint system handle fallbacks.

**The Resulting Rule**: When requesting specific hardware capabilities via `getUserMedia`, use `{ ideal: value }` instead of `{ exact: value }` unless the feature absolutely cannot function without the exact constraint. Pair with `enumerateDevices()` to gate UI affordances (e.g., flip button visibility).

**Future Warning**: `enumerateDevices()` may return empty labels until the user grants camera permission (privacy restriction). The flip button detection should be called AFTER `getUserMedia` succeeds, not before.

**rules.md**: none (browser API pattern)

## 🗓️ 2026-02-28 — Lesson 19: Always .trim() API Keys from Environment Variables

**The Discovery**: `DEEPGRAM_API_KEY` from Google Cloud Secret Manager contained a trailing newline. The Deepgram SDK passed it as the `Authorization` header value when opening a WebSocket. Node.js's `ClientRequest.setHeader` rejects headers with control characters (`ERR_INVALID_CHAR`), crashing the server with exit code 7.

**The Scientific Proof**: Server logs showed `TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["Authorization"]` at `AbstractLiveClient.js:165` (Deepgram SDK), traced to `ws/lib/websocket.js:88`. The crash killed WebSocket connections mid-session, causing the client to show "Audio playback failed."

**The Resulting Rule**: Always `.trim()` API keys loaded from `process.env`. Secret Manager, dotenv, and dashboard copy-paste frequently introduce trailing newlines. Also: add `uncaughtException`/`unhandledRejection` handlers to prevent individual errors from crashing the entire server.

**rules.md**: none (ops hygiene)

## 🗓️ 2026-02-28 — Lesson 18: Property Test Arbitraries Must Mirror Production Logic

**The Discovery**: The `gestureDisplacementArb` computed `normalizedDisplacement` as `maxDisplacement / bodyBboxHeight`, where `bodyBboxHeight` was the nose-to-hip distance. But `extractBodyBboxHeight` in production uses `max(y) - min(y)` over ALL confident keypoints — including wrists and elbows. When wrist Y values exceeded `hipY`, the actual bbox height was larger than assumed, making the normalized displacement smaller, causing a false expectation.

**The Scientific Proof**: Counterexample: threshold=0.05, bodyBboxHeight=50, wrist at y=176→179. Test expected normalized displacement = 3/50 = 0.06 > threshold → gesture. Production: actual bbox = 179-100 = 79, normalized = 3/79 = 0.038 < threshold → no gesture. Mismatch → flaky test.

**The Resulting Rule**: Property test arbitraries must replicate the exact computation used in production code. When testing derived thresholds, compute the expected outcome using the same algorithm as the SUT, not a simplified version.

**rules.md**: none (testing pattern)

## 🗓️ 2026-02-28 — Lesson 17: Firebase Auth API Key Must Match Hosting init.json

**The Discovery**: `signInWithPopup` opens the auth handler at `{authDomain}/__/auth/handler?apiKey={key}`. The handler validates the API key against its own `/__/firebase/init.json`. If the key doesn't match, it returns "The requested action is invalid." — a misleading error that doesn't mention the key mismatch.

**The Scientific Proof**: The web app registration created a second API key (`AIzaSyDq...`), different from the browser key in `init.json` (`AIzaSyCqc...`). Using the web app key → "The requested action is invalid." Switching to the browser key → sign-in works. The URL bar in the failing popup visibly showed `apiKey=AIzaSyDq...`.

**The Farley Principle Applied**: When a Firebase project has multiple API keys (auto-created browser key, web app key), use the one from `https://{project}.firebaseapp.com/__/firebase/init.json`. The auth handler page on `firebaseapp.com` validates against THIS key specifically, regardless of which keys are valid for the project.

**The Resulting Rule**: For Firebase Auth with `signInWithPopup`/`signInWithRedirect`, always use the API key from the Firebase Hosting `init.json` endpoint (the browser key), not the web app SDK config key. Verify with: `curl https://{project}.firebaseapp.com/__/firebase/init.json`.

**Future Warning**: `signInWithRedirect` has additional issues — the auth result can be lost in the cross-origin redirect chain (origin → firebaseapp.com → Google → firebaseapp.com → origin). Prefer `signInWithPopup` unless popups are blocked by browser policy.

**rules.md**: none (Firebase-specific)

## 🗓️ 2026-02-27 — Lesson 16: Cloud Run GCLB Ingress and IAM Compatibility

**The Discovery**: When org policy blocks `allUsers` as Cloud Run invoker, use `--no-invoker-iam-check` to disable IAM auth at the service level. Combined with `ingress=all`, this lets the GCLB route unauthenticated traffic to the app, which handles auth itself via Firebase Auth.

**The Scientific Proof**: `ingress=internal-and-cloud-load-balancing` returned persistent 404 from Google infrastructure — the LB traffic was being rejected before reaching the container. The `EXTERNAL_MANAGED` LB scheme also returned 404. Classic `EXTERNAL` scheme with `ingress=all` + `--no-invoker-iam-check` is the working combination.

**The Farley Principle Applied**: When multiple infrastructure layers can handle auth (Cloud Run IAM, Cloud Run ingress, app middleware), pick ONE authoritative layer and disable the others. Trying to layer all three creates hard-to-debug interactions.

**The Resulting Rule**: For Cloud Run behind a GCLB with app-level auth: use `ingress=all` + `--no-invoker-iam-check` + classic `EXTERNAL` scheme. Don't use `internal-and-cloud-load-balancing` ingress — it may not recognize GCLB traffic correctly. Serverless NEGs don't support `portName` so avoid `--protocol=HTTPS` on the backend service.

**rules.md**: none (GCP-specific)

## 🗓️ 2026-02-27 — Lesson 15: Cloud Run Cookie Stripping and Firebase Auth Design

**The Discovery**: Cloud Run strips all cookies from incoming requests except `__session`. This means standard session cookies (e.g., `connect.sid`, custom names) are invisible to the server. Firebase Auth tokens must be stored in a cookie named `__session`.

**The Scientific Proof**: Firebase Auth compat SDK sets the token client-side. The `cookie-parser` middleware reads `req.cookies.__session` server-side. The `createAuthMiddleware` extracts, verifies via `firebase-admin`, and checks the email against `ALLOWED_EMAILS`. WebSocket upgrade uses `cookie` module to parse the raw `Cookie` header from the upgrade request.

**The Farley Principle Applied**: When deploying behind a managed proxy that strips cookies, use the one cookie name the proxy preserves rather than fighting the proxy configuration.

**The Resulting Rule**: For Cloud Run with Firebase Auth, always use `__session` as the cookie name. Auth should be opt-in via `ALLOWED_EMAILS`: when empty, auth is disabled (dev mode). Mount the auth middleware after `/health` but before `express.static()` so login assets are accessible but the app is protected.

**Future Warning**: Firebase Auth compat SDK (v9 compat) is in maintenance mode. The modular v10+ SDK requires a bundler. If adding a build step later, migrate to modular imports.

**rules.md**: none (GCP-specific)

## 🗓️ 2026-02-27 — Lesson 14: WIF Credentials Cannot Generate Identity Tokens for Cloud Run Health Checks

**The Discovery**: `gcloud auth print-identity-token --audiences=$URL` fails with WIF federated credentials ("Invalid account type for `--audiences`"). Using `--impersonate-service-account` also fails because the service account can't impersonate itself without `roles/iam.serviceAccountTokenCreator` on itself (circular dependency).

**The Scientific Proof**: Three CI/CD deploy runs failed at the verify step. Run 1: WIF identity missing `workloadIdentityUser`. Run 2: Artifact Registry `uploadArtifacts` denied. Run 3: `--audiences` not supported for WIF. Run 4: `--impersonate-service-account` self-impersonation denied. Run 5: Switched to `gcloud run services describe` readiness check → ✅ passed.

**The Farley Principle Applied**: When a tool's API doesn't support your auth model, change the approach rather than fighting the auth chain. GCP Cloud Run readiness conditions provide the same signal as an HTTP health check without requiring an identity token.

**The Resulting Rule**: For CI/CD deploy verification on authenticated Cloud Run services using WIF, use `gcloud run services describe --format='value(status.conditions[0].status)'` to check readiness instead of HTTP health checks. This avoids the WIF identity token limitation entirely.

**Future Warning**: If the service is ever made public (`allUsers` invoker), switch back to `curl $URL/health` for a stronger end-to-end check. The WIF deployer service account also needs: `roles/iam.workloadIdentityUser` (on itself), `roles/artifactregistry.writer`, `roles/run.admin`, `roles/iam.serviceAccountUser` (project-level).

**rules.md**: none (GCP-specific, not generalizable)

## 🗓️ 2026-02-27 — Lesson 13: @tensorflow/tfjs-node vs WASM Backend on Node.js v25

**The Discovery**: `@tensorflow/tfjs-node` native bindings use `util.isNullOrUndefined()` and `util.isNull()`, both removed in Node.js v25. The `util` module is now frozen — polyfilling is impossible (`Object is not extensible`).

**The Scientific Proof**: `npx tsx experiment_canary.ts` with tfjs-node crashed on `cast()`. Switching to `@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm` worked: BlazeFace face detection at 5-8ms/frame, MoveNet pose at 18-21ms/frame (total 25-34ms, well under 500ms budget).

**The Farley Principle Applied**: When a native dependency breaks on a new runtime, check for WASM/pure-JS alternatives before downgrading Node.js. WASM backends are portable and avoid native compilation issues.

**The Resulting Rule**: For TF.js on Node.js v25+, use `@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm`. Do NOT use `@tensorflow/tfjs-node`. Call `setWasmPaths()` with the dist/ directory before `setBackend("wasm")`. Point at `node_modules/@tensorflow/tfjs-backend-wasm/dist/` relative to the importing file.

**Future Warning**: When Node.js v26 ships, re-test WASM backend compatibility. Also test `@tensorflow/tfjs-node` in case they fix the `util` polyfill.

**rules.md**: Should add R12 — TF.js must use WASM backend on Node.js v25+

## 🗓️ 2026-02-27 — Lesson 12: commit-and-tag-version Treats feat as Patch in 0.x

**The Discovery**: `commit-and-tag-version` auto-detected `0.4.1` (patch) despite having `feat:` commits since `v0.4.0`. Per strict semver, 0.x versions treat the minor number as the "breaking change" indicator and patch as the "feature" indicator. This is documented in semver.org §4: "Major version zero is for initial development. Anything MAY change at any time."

**The Scientific Proof**: `npx commit-and-tag-version --dry-run` showed `0.4.1`. `npx commit-and-tag-version --dry-run --release-as minor` showed `0.5.0`. The auto-detect behavior is deliberate, not a bug.

**The Farley Principle Applied**: Tools encode opinions. When a tool's default conflicts with project intent, configure it explicitly rather than hoping it "just works."

**The Resulting Rule**: For 0.x projects using commit-and-tag-version, always use `--release-as minor` when feat commits are present, or `--release-as patch` for fix-only releases. Auto-detect is only reliable at 1.0+. The `/release` workflow documents this.

**Future Warning**: Once the project reaches 1.0, auto-detect (`npm run release` with no flags) will correctly treat `feat:` as minor and `fix:` as patch.

**rules.md**: none

## 🗓️ 2026-02-26 — Lesson 11: Optimistic UI Button Guards Prevent Double-Submit

**The Discovery**: The "Start Speech" button's `onclick` handler was async (it `await`s `startAudioCapture()`). During the await, the button remained clickable, allowing rapid double-clicks to send two `start_recording` messages. The server correctly rejected the second with an "Invalid state transition" error, but the error banner alarmed users.

**The Scientific Proof**: Browser inspection reproduced the bug: triple-clicking Start Speech produced two server-side errors. After adding `disable(dom.btnStart)` as the first line of `onStartSpeech()`, the same triple-click produced zero errors.

**The Farley Principle Applied**: Optimistic UI — disable interactive elements before async work begins, not after. Re-enable in early-return guard paths and on error.

**The Resulting Rule**: Any button handler that triggers an async operation (network request, mic acquisition, etc.) must `disable()` the button as its first action. Guard clauses that return early must `enable()` it again. The "happy path" re-enable happens via `updateUI()` on state transition.

**Future Warning**: This pattern must be applied to any new async button handlers. The Upload Video button also triggers async work and should be reviewed for the same vulnerability.

**rules.md**: none

## 🗓️ 2026-02-26 — Lesson 10: Bulk Rename Requires Multi-Pass Grep Verification

**The Discovery**: Renaming "AI Toastmasters Evaluator" to "AI Speech Evaluator" initially appeared to be a simple 23-hit sed across 15 files. After the first sed pass, a comprehensive grep revealed 40+ additional references in test describe names (`Feature: ai-toastmasters-evaluator`), AI prompt strings, output format headers, `.kiro/specs/` design docs, `package-lock.json`, inline JS comments, and test fixture data. Three passes were needed to reach zero.

**The Scientific Proof**: `grep -rni "Toastmasters" . | wc -l` returned 0 after the third pass. The first pass caught 23/~60 references, the second caught ~35 more, the third caught the final 5 in `.kiro/specs/`.

**The Farley Principle Applied**: Rename operations have a long tail. The obvious hits (user-facing strings) are only the tip. Test assertions that validate prompt content, design docs, and auto-generated files (`package-lock.json`) all carry the old name.

**The Resulting Rule**: After a brand/name rename, run `grep -rni "OLD_NAME" . | grep -v node_modules | grep -v dist` and iterate until the count is zero. Budget for 2-3 passes minimum. Include `.kiro/`, `package-lock.json`, test assertions that validate string content, and JS comments.

**Future Warning**: The `package-lock.json` must be regenerated via `npm install --package-lock-only` — sed cannot reliably edit it. Test assertions that `toContain("old prompt text")` will fail silently if the source prompt was changed but the test expectation was not.

**rules.md**: none

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

## 🗓️ 2026-03-15 — Lesson 35: Missing ES Module Exports Cause Silent Evaluation Failure

**The Discovery**: During the `app.js` decomposition, `video.js` was missing the `toggleVideoSize` export. Because ES modules validate all imports at load time, the entire `app.js` module silently failed to evaluate — no console errors, no stack traces. The Module→Global Bridge at the bottom of `app.js` never ran, so all `onclick` handlers returned `ReferenceError`.

**The Scientific Proof**: Running `import('/js/app.js')` manually in the browser console surfaced the real error: `SyntaxError: The requested module './video.js' does not provide an export named 'toggleVideoSize'`. Adding the missing function to `video.js` and reloading restored all functionality.

**The Farley Principle Applied**: Falsifiability — the failure was invisible because the module loader silently aborts. The manual import provided the falsifiable test.

**The Resulting Rule**: After any module extraction, run `import('/js/entry.js')` in the browser console to surface SyntaxErrors. Never trust a clean page load with no errors as proof that modules loaded correctly.

**Future Warning**: Any batch extraction of functions across multiple line ranges risks missing functions that aren't adjacent to the main block. Always `grep` for every import name in the target module to confirm it exists.

## 🗓️ 2026-03-15 — Lesson 36: Batch Module Extraction — Remove Lines in Reverse Order

**The Discovery**: When extracting multiple line ranges from `app.js` into separate modules, removing blocks from top-to-bottom shifted line numbers for subsequent removals. The initialization code at the bottom of `app.js` was accidentally included in a later extraction range because line numbers were calculated from the original file, not the file as modified by prior removals.

**The Scientific Proof**: After batch extraction, `app.js` was missing its initialization code (theme toggle, `switchMode("live")`, event listeners). Recovering from git history and re-applying confirmed that the root cause was shifted line numbers.

**The Farley Principle Applied**: Evolutionary Architecture — each extraction should leave the system in a releasable state. Processing ranges bottom-to-top preserves line number stability.

**The Resulting Rule**: When removing multiple non-contiguous blocks from a file, always process them in reverse order (highest line numbers first). Verify the remaining file after each removal, not just at the end.

**Future Warning**: Any future large-scale extraction should prefer incremental extract-and-commit cycles over batch processing. Each cycle should include a browser verification.

## 🗓️ 2026-03-15 — Lesson 37: Safari ITP Breaks Firebase signInWithPopup via Cross-Origin Storage Partitioning

**The Discovery**: Firebase `signInWithPopup` on iOS Safari fails with "Unable to process request due to missing initial state." Safari's Intelligent Tracking Prevention (ITP) partitions `sessionStorage` across different origins. When `authDomain` is set to a Firebase Hosting domain (`project.firebaseapp.com`) — different from the app's domain (`eval.taverns.red`) — the state stored before the OAuth redirect is inaccessible when the redirect returns.

**The Scientific Proof**: The error message explicitly mentions "storage-partitioned browser environment." Firebase's own documentation recommends using the app's own domain as `authDomain` and proxying `/__/auth/handler` to eliminate the cross-origin issue.

**The Farley Principle Applied**: Evolutionary Architecture — detect the browser environment and use the appropriate auth flow (`signInWithRedirect` for Safari, `signInWithPopup` for desktop) rather than forcing a single approach for all platforms.

**The Resulting Rule**: Always set `authDomain` to the app's own domain (not `project.firebaseapp.com`) and proxy `/__/auth/*` through the app server. Detect iOS/Safari and use `signInWithRedirect` with `getRedirectResult()` on page load.

**Future Warning**: Any new Firebase project must include the `/__/auth/*` reverse proxy from day one. The fallback `authDomain` in `index.ts` must match the production domain.

## 🗓️ 2026-03-15 — Lesson 38: Serverless NEG Region Must Match Cloud Run Service Region

**The Discovery**: After migrating Cloud Run services from `us-east1` to `northamerica-northeast1`, the custom domain (`eval.taverns.red`) returned a 404. The CI/CD pipeline deployed successfully, but the load balancer's serverless NEG still pointed to the old region.

**The Scientific Proof**: `gcloud compute network-endpoint-groups describe speech-evaluator-neg --region=us-east1` showed `cloudRun.service: speech-evaluator` in the wrong region. Creating a new NEG in `northamerica-northeast1` and swapping it into the backend service restored routing immediately.

**The Farley Principle Applied**: Infrastructure-as-code — any region migration must include a checklist of all dependent resources (NEGs, domain mappings, SSL certs, backend services). The CI workflow only covered Artifact Registry and Cloud Run deploy, but missed the load balancer layer.

**The Resulting Rule**: When migrating Cloud Run regions: (1) create a new NEG in the target region, (2) swap it into the backend service, (3) delete the old NEG, (4) verify via direct curl. Domain mappings are NOT supported in all regions — check first.

**Future Warning**: `timeoutSec` on backend services does NOT apply to serverless NEGs. Cloud Run's `--timeout` flag is the controlling value. Do not waste time trying to set backend timeouts for serverless backends — `gcloud` will reject it with error code 400.

## 🗓️ 2026-03-15 — Lesson 39: Structured Logging Migration — Bridge Pattern

**The Discovery**: When replacing `console.log`/`console.error` with a structured JSON logger (`process.stdout.write`), existing tests that spy on `console.log` will silently pass (no assertions hit) or fail. The structured logger bypasses `console.*` entirely.

**The Scientific Proof**: 3/1724 tests failed after the migration. All three were spying on `console.log`/`console.warn`/`console.error` which were no longer called. Updating spies to `process.stdout.write` fixed all 3.

**The Resulting Rule**: When migrating logging, search for `console.log`/`console.error`/`console.warn` in **test files too**, not just source files. Update all test spies to match the new output channel (`process.stdout.write` for structured loggers).

**Bridge Pattern**: For modules with established interfaces (like `ServerLogger` with `...args` signature), create a bridge that adapts the structured logger to the existing interface. This avoids breaking test infrastructure while getting structured output in production.

## 🗓️ 2026-03-15 — Lesson 40: Metrics Instrumentation via Optional Chaining

**The Discovery**: `MetricsCollector` was in place (Sprint 1) but nothing called it. The counters were permanently zero. The fix was straightforward: `this.deps.metricsCollector?.incrementSessions()` at each injection point.

**The Resulting Rule**: When adding observability infrastructure, always ship **instrumentation** in the same sprint as the **collector/endpoint**. Otherwise the endpoint gives a false sense of monitoring. Optional chaining (`?.`) keeps it zero-coupling — existing tests don't need to provide a collector.

## 🗓️ 2026-03-16 — Lesson 41: Layered Retry Strategy

**The Discovery**: The evaluation generator already has extensive LLM-level retry (shape validation + per-item re-prompt + short-form fallback). Adding HTTP-level retry needed to sit **below** this existing pipeline — wrapping only the `create()` call, not the validation logic.

**The Resulting Rule**: When adding retry to a system that already has application-level retry, wrap only the lowest-level I/O call. HTTP retries handle transient server errors (5xx, 429, network); application retries handle semantic failures (bad LLM output, validation failures). The two layers must not interfere.

## 🗓️ 2026-03-19 — Lesson 42: Silent Failures from Missing ES Module Imports

**The Discovery**: The download evaluation button did nothing — zero user feedback. Root cause: `buildZip()` was called in `upload.js` but never imported from `ui.js`. In ES modules, this is a `ReferenceError` at call time, not at module load. Since the call was inside an `onclick` handler with no `try/catch`, the error was swallowed silently.

**The Resulting Rule**: When extracting functions into a new module, `grep` for every call site to verify imports are wired. ES module missing-import errors are silent at load time and only surface when the code path is actually executed — which may be a rarely-tested UI flow like "download after upload."

## 🗓️ 2026-03-19 — Lesson 43: Recurring Missing Imports After Module Extraction (#110)

**The Discovery**: `audio.js` used `STATUS_TEXT` (line 194, from `constants.js`) and `stopVideoCapture` (line 160, from `video.js`) without importing either. The `STATUS_TEXT` error only surfaced when the cooldown timer fired after TTS playback — a code path that requires a full live-mode speech cycle to reach. The `stopVideoCapture` error was latent in `hardStopMic()`, only triggered during echo prevention.

**The Scientific Proof**: Browser console showed `ReferenceError: Can't find variable: STATUS_TEXT` at `audio.js:194`. Adding both imports and re-testing eliminated the error.

**The Resulting Rule**: This is the **third** instance of this bug class (Lessons 35, 42, 43). After any module extraction, run `grep -rn 'IDENTIFIER' public/js/` for **every** identifier used in the extracted file and verify each has a corresponding `import` statement. Do not rely on page-load testing — many code paths are only reachable through specific user flows (cooldown, panic mute, upload-then-download).

## 🗓️ 2026-03-21 — Lesson 45: Frontend Mode Toggles Are Cheaper Than Backend Mode Variants

**The Discovery**: When adding Practice Mode (solo rehearsal), the initial instinct was to create a new session type or backend pipeline variant. Analysis of `session-manager.ts` showed the existing pipeline (consent → record → transcribe → evaluate → TTS) already handles everything Practice Mode needs — the difference is purely UI: simplified consent, no video, no project context. The backend only needed a thin `sessionMode` field on `ConnectionState` (3 lines) plus a `set_session_mode` case in the WS switch (2 lines). The entire feature was 70 net new lines across 7 files — of which 45 were frontend.

**The Resulting Rule**: Before adding a new "mode" to a backend pipeline, audit whether the existing pipeline already covers the use case. Often, new modes differ only in **UI gating** (what's shown/hidden) and **metadata tagging** (GCS labels). A frontend-only mode toggle paired with a thin backend metadata tag is dramatically cheaper and safer than a full pipeline variant.

**Future Warning**: If a future feature like "Classroom Mode" or "Interview Prep Mode" is proposed, first check if it's just a different preset of the existing consent + configuration + evaluation pipeline with different UI visibility.

## 🗓️ 2026-03-21 — Lesson 46: Well-Paved Extensibility Patterns Pay Compound Dividends

**The Discovery**: Adding 5 new evaluation feedback styles (EEC, Radical Candour, Socratic, Comparative, Micro-Focus) took ~30 minutes because Sprint C4 (#133) established a clean extensibility pattern: enum value + TypeScript interface + prompt `.txt` file + `STYLE_TEMPLATE_MAP` entry + radio button + `STYLE_FIELD_CONFIG` render config. No changes to the evaluation pipeline, parsing logic, or API contracts were needed — each new style was a pure data/config addition.

**The Resulting Rule**: When building a framework's first extension point (like "evaluation styles"), invest extra time in making the extension pattern discoverable and mechanical: a config map, a registry, and a template directory. The first 5 styles cost significant design effort; the next 5 cost almost nothing because the pattern was well-paved.

**Future Warning**: The `STYLE_FIELD_CONFIG` renderer handles scalar strings and arrays (`isArray: true`) but not nested objects. If a future style needs nested structured data (e.g., a rubric with sub-dimensions), the renderer will need a new field type.

**rules.md**: none

## 🗓️ 2026-03-21 — Lesson 47: Pure-Frontend Features Are Free Wins for Sprint Velocity

**The Discovery**: The Comparative Analytics feature (#154) required zero new API endpoints, zero backend changes, and zero new dependencies. The comparison panel (select 2 evaluations → side-by-side metric diff table) was a pure frontend addition using metadata already loaded from the existing `historyResults` array. Total: 3 files, ~200 lines.

**The Resulting Rule**: When grooming sprint candidates, prioritize features that can be built entirely in the existing frontend data model. They have zero blast radius on the backend, require no new tests for server code, and ship faster. Flag them with a "frontend-only" label during planning.

**Future Warning**: The comparison currently only uses metadata (WPM, duration, passRate). To compare category scores or feedback items, the evaluation detail must be fetched — this would require lazy-loading both evaluations' data, which adds complexity.

**rules.md**: none
