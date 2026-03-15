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

## 🗓️ 2026-02-26 — Lesson 10: Bulk Rename Requires Multi-Pass Grep Verification

**The Discovery**: Renaming "AI Toastmasters Evaluator" to "AI Speech Evaluator" initially appeared to be a simple 23-hit sed across 15 files. After the first sed pass, a comprehensive grep revealed 40+ additional references in test describe names (`Feature: ai-toastmasters-evaluator`), AI prompt strings, output format headers, `.kiro/specs/` design docs, `package-lock.json`, inline JS comments, and test fixture data. Three passes were needed to reach zero.

**The Scientific Proof**: `grep -rni "Toastmasters" . | wc -l` returned 0 after the third pass. The first pass caught 23/~60 references, the second caught ~35 more, the third caught the final 5 in `.kiro/specs/`.

**The Farley Principle Applied**: Rename operations have a long tail. The obvious hits (user-facing strings) are only the tip. Test assertions that validate prompt content, design docs, and auto-generated files (`package-lock.json`) all carry the old name.

**The Resulting Rule**: After a brand/name rename, run `grep -rni "OLD_NAME" . | grep -v node_modules | grep -v dist` and iterate until the count is zero. Budget for 2-3 passes minimum. Include `.kiro/`, `package-lock.json`, test assertions that validate string content, and JS comments.

**Future Warning**: The `package-lock.json` must be regenerated via `npm install --package-lock-only` — sed cannot reliably edit it. Test assertions that `toContain("old prompt text")` will fail silently if the source prompt was changed but the test expectation was not.

**rules.md**: none

## 🗓️ 2026-02-26 — Lesson 11: Optimistic UI Button Guards Prevent Double-Submit

**The Discovery**: The "Start Speech" button's `onclick` handler was async (it `await`s `startAudioCapture()`). During the await, the button remained clickable, allowing rapid double-clicks to send two `start_recording` messages. The server correctly rejected the second with an "Invalid state transition" error, but the error banner alarmed users.

**The Scientific Proof**: Browser inspection reproduced the bug: triple-clicking Start Speech produced two server-side errors. After adding `disable(dom.btnStart)` as the first line of `onStartSpeech()`, the same triple-click produced zero errors.

**The Farley Principle Applied**: Optimistic UI — disable interactive elements before async work begins, not after. Re-enable in early-return guard paths and on error.

**The Resulting Rule**: Any button handler that triggers an async operation (network request, mic acquisition, etc.) must `disable()` the button as its first action. Guard clauses that return early must `enable()` it again. The "happy path" re-enable happens via `updateUI()` on state transition.

**Future Warning**: This pattern must be applied to any new async button handlers. The Upload Video button also triggers async work and should be reviewed for the same vulnerability.

**rules.md**: none

## 🗓️ 2026-02-27 — Lesson 12: commit-and-tag-version Treats feat as Patch in 0.x

**The Discovery**: `commit-and-tag-version` auto-detected `0.4.1` (patch) despite having `feat:` commits since `v0.4.0`. Per strict semver, 0.x versions treat the minor number as the "breaking change" indicator and patch as the "feature" indicator. This is documented in semver.org §4: "Major version zero is for initial development. Anything MAY change at any time."

**The Scientific Proof**: `npx commit-and-tag-version --dry-run` showed `0.4.1`. `npx commit-and-tag-version --dry-run --release-as minor` showed `0.5.0`. The auto-detect behavior is deliberate, not a bug.

**The Farley Principle Applied**: Tools encode opinions. When a tool's default conflicts with project intent, configure it explicitly rather than hoping it "just works."

**The Resulting Rule**: For 0.x projects using commit-and-tag-version, always use `--release-as minor` when feat commits are present, or `--release-as patch` for fix-only releases. Auto-detect is only reliable at 1.0+. The `/release` workflow documents this.

**Future Warning**: Once the project reaches 1.0, auto-detect (`npm run release` with no flags) will correctly treat `feat:` as minor and `fix:` as patch.

**rules.md**: none

## 🗓️ 2026-02-27 — Lesson 13: @tensorflow/tfjs-node vs WASM Backend on Node.js v25

**The Discovery**: `@tensorflow/tfjs-node` native bindings use `util.isNullOrUndefined()` and `util.isNull()`, both removed in Node.js v25. The `util` module is now frozen — polyfilling is impossible (`Object is not extensible`).

**The Scientific Proof**: `npx tsx experiment_canary.ts` with tfjs-node crashed on `cast()`. Switching to `@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm` worked: BlazeFace face detection at 5-8ms/frame, MoveNet pose at 18-21ms/frame (total 25-34ms, well under 500ms budget).

**The Farley Principle Applied**: When a native dependency breaks on a new runtime, check for WASM/pure-JS alternatives before downgrading Node.js. WASM backends are portable and avoid native compilation issues.

**The Resulting Rule**: For TF.js on Node.js v25+, use `@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm`. Do NOT use `@tensorflow/tfjs-node`. Call `setWasmPaths()` with the dist/ directory before `setBackend("wasm")`. Point at `node_modules/@tensorflow/tfjs-backend-wasm/dist/` relative to the importing file.

**Future Warning**: When Node.js v26 ships, re-test WASM backend compatibility. Also test `@tensorflow/tfjs-node` in case they fix the `util` polyfill.

**rules.md**: Should add R12 — TF.js must use WASM backend on Node.js v25+

## 🗓️ 2026-02-27 — Lesson 14: WIF Credentials Cannot Generate Identity Tokens for Cloud Run Health Checks

**The Discovery**: `gcloud auth print-identity-token --audiences=$URL` fails with WIF federated credentials ("Invalid account type for `--audiences`"). Using `--impersonate-service-account` also fails because the service account can't impersonate itself without `roles/iam.serviceAccountTokenCreator` on itself (circular dependency).

**The Scientific Proof**: Three CI/CD deploy runs failed at the verify step. Run 1: WIF identity missing `workloadIdentityUser`. Run 2: Artifact Registry `uploadArtifacts` denied. Run 3: `--audiences` not supported for WIF. Run 4: `--impersonate-service-account` self-impersonation denied. Run 5: Switched to `gcloud run services describe` readiness check → ✅ passed.

**The Farley Principle Applied**: When a tool's API doesn't support your auth model, change the approach rather than fighting the auth chain. GCP Cloud Run readiness conditions provide the same signal as an HTTP health check without requiring an identity token.

**The Resulting Rule**: For CI/CD deploy verification on authenticated Cloud Run services using WIF, use `gcloud run services describe --format='value(status.conditions[0].status)'` to check readiness instead of HTTP health checks. This avoids the WIF identity token limitation entirely.

**Future Warning**: If the service is ever made public (`allUsers` invoker), switch back to `curl $URL/health` for a stronger end-to-end check. The WIF deployer service account also needs: `roles/iam.workloadIdentityUser` (on itself), `roles/artifactregistry.writer`, `roles/run.admin`, `roles/iam.serviceAccountUser` (project-level).

**rules.md**: none (GCP-specific, not generalizable)

## 🗓️ 2026-02-27 — Lesson 15: Cloud Run Cookie Stripping and Firebase Auth Design

**The Discovery**: Cloud Run strips all cookies from incoming requests except `__session`. This means standard session cookies (e.g., `connect.sid`, custom names) are invisible to the server. Firebase Auth tokens must be stored in a cookie named `__session`.

**The Scientific Proof**: Firebase Auth compat SDK sets the token client-side. The `cookie-parser` middleware reads `req.cookies.__session` server-side. The `createAuthMiddleware` extracts, verifies via `firebase-admin`, and checks the email against `ALLOWED_EMAILS`. WebSocket upgrade uses `cookie` module to parse the raw `Cookie` header from the upgrade request.

**The Farley Principle Applied**: When deploying behind a managed proxy that strips cookies, use the one cookie name the proxy preserves rather than fighting the proxy configuration.

**The Resulting Rule**: For Cloud Run with Firebase Auth, always use `__session` as the cookie name. Auth should be opt-in via `ALLOWED_EMAILS`: when empty, auth is disabled (dev mode). Mount the auth middleware after `/health` but before `express.static()` so login assets are accessible but the app is protected.

**Future Warning**: Firebase Auth compat SDK (v9 compat) is in maintenance mode. The modular v10+ SDK requires a bundler. If adding a build step later, migrate to modular imports.

**rules.md**: none (GCP-specific)

## 🗓️ 2026-02-27 — Lesson 16: Cloud Run GCLB Ingress and IAM Compatibility

**The Discovery**: When org policy blocks `allUsers` as Cloud Run invoker, use `--no-invoker-iam-check` to disable IAM auth at the service level. Combined with `ingress=all`, this lets the GCLB route unauthenticated traffic to the app, which handles auth itself via Firebase Auth.

**The Scientific Proof**: `ingress=internal-and-cloud-load-balancing` returned persistent 404 from Google infrastructure — the LB traffic was being rejected before reaching the container. The `EXTERNAL_MANAGED` LB scheme also returned 404. Classic `EXTERNAL` scheme with `ingress=all` + `--no-invoker-iam-check` is the working combination.

**The Farley Principle Applied**: When multiple infrastructure layers can handle auth (Cloud Run IAM, Cloud Run ingress, app middleware), pick ONE authoritative layer and disable the others. Trying to layer all three creates hard-to-debug interactions.

**The Resulting Rule**: For Cloud Run behind a GCLB with app-level auth: use `ingress=all` + `--no-invoker-iam-check` + classic `EXTERNAL` scheme. Don't use `internal-and-cloud-load-balancing` ingress — it may not recognize GCLB traffic correctly. Serverless NEGs don't support `portName` so avoid `--protocol=HTTPS` on the backend service.

**rules.md**: none (GCP-specific)

## 🗓️ 2026-02-28 — Lesson 17: Firebase Auth API Key Must Match Hosting init.json

**The Discovery**: `signInWithPopup` opens the auth handler at `{authDomain}/__/auth/handler?apiKey={key}`. The handler validates the API key against its own `/__/firebase/init.json`. If the key doesn't match, it returns "The requested action is invalid." — a misleading error that doesn't mention the key mismatch.

**The Scientific Proof**: The web app registration created a second API key (`AIzaSyDq...`), different from the browser key in `init.json` (`AIzaSyCqc...`). Using the web app key → "The requested action is invalid." Switching to the browser key → sign-in works. The URL bar in the failing popup visibly showed `apiKey=AIzaSyDq...`.

**The Farley Principle Applied**: When a Firebase project has multiple API keys (auto-created browser key, web app key), use the one from `https://{project}.firebaseapp.com/__/firebase/init.json`. The auth handler page on `firebaseapp.com` validates against THIS key specifically, regardless of which keys are valid for the project.

**The Resulting Rule**: For Firebase Auth with `signInWithPopup`/`signInWithRedirect`, always use the API key from the Firebase Hosting `init.json` endpoint (the browser key), not the web app SDK config key. Verify with: `curl https://{project}.firebaseapp.com/__/firebase/init.json`.

**Future Warning**: `signInWithRedirect` has additional issues — the auth result can be lost in the cross-origin redirect chain (origin → firebaseapp.com → Google → firebaseapp.com → origin). Prefer `signInWithPopup` unless popups are blocked by browser policy.

**rules.md**: none (Firebase-specific)

## 🗓️ 2026-02-28 — Lesson 18: Property Test Arbitraries Must Mirror Production Logic

**The Discovery**: The `gestureDisplacementArb` computed `normalizedDisplacement` as `maxDisplacement / bodyBboxHeight`, where `bodyBboxHeight` was the nose-to-hip distance. But `extractBodyBboxHeight` in production uses `max(y) - min(y)` over ALL confident keypoints — including wrists and elbows. When wrist Y values exceeded `hipY`, the actual bbox height was larger than assumed, making the normalized displacement smaller, causing a false expectation.

**The Scientific Proof**: Counterexample: threshold=0.05, bodyBboxHeight=50, wrist at y=176→179. Test expected normalized displacement = 3/50 = 0.06 > threshold → gesture. Production: actual bbox = 179-100 = 79, normalized = 3/79 = 0.038 < threshold → no gesture. Mismatch → flaky test.

**The Resulting Rule**: Property test arbitraries must replicate the exact computation used in production code. When testing derived thresholds, compute the expected outcome using the same algorithm as the SUT, not a simplified version.

**rules.md**: none (testing pattern)

## 🗓️ 2026-02-28 — Lesson 19: Always .trim() API Keys from Environment Variables

**The Discovery**: `DEEPGRAM_API_KEY` from Google Cloud Secret Manager contained a trailing newline. The Deepgram SDK passed it as the `Authorization` header value when opening a WebSocket. Node.js's `ClientRequest.setHeader` rejects headers with control characters (`ERR_INVALID_CHAR`), crashing the server with exit code 7.

**The Scientific Proof**: Server logs showed `TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["Authorization"]` at `AbstractLiveClient.js:165` (Deepgram SDK), traced to `ws/lib/websocket.js:88`. The crash killed WebSocket connections mid-session, causing the client to show "Audio playback failed."

**The Resulting Rule**: Always `.trim()` API keys loaded from `process.env`. Secret Manager, dotenv, and dashboard copy-paste frequently introduce trailing newlines. Also: add `uncaughtException`/`unhandledRejection` handlers to prevent individual errors from crashing the entire server.

**rules.md**: none (ops hygiene)

## 🗓️ 2026-03-14 — Lesson 22: Cloud Run Container Disk is Ephemeral — Never Rely on It for User Data

**The Discovery**: `FilePersistence.saveSession()` wrote evaluation outputs (transcript, metrics, evaluation, audio) to the container's `output/` directory. Users clicked "Save Outputs" and got a confirmation message, but the files were invisible and lost on the next deploy, scale event, or container restart. The user's latest evaluation was irrecoverably deleted when we deployed the timeout fix (#53).

**The Scientific Proof**: After deploying commit `969dfa2` (Cloud Run timeout fix), the user reported their saved evaluation was gone. Cloud Run documentation confirms: container filesystem is in-memory tmpfs, cleared on every new instance.

**The Resulting Rule**: Any "save" operation on Cloud Run must deliver data to the client (download, email, external storage), not to the container's local filesystem. Server-side disk persistence is acceptable only as a secondary/debug mechanism, never as the primary user-facing path. For this app: serialize files in the WebSocket `outputs_saved` response and trigger a client-side ZIP download.

**rules.md**: none (infrastructure pattern)

## 🗓️ 2026-03-14 — Lesson 23: Multer Middleware Errors Escape to Express Default 500 Handler

**The Discovery**: When `uploadMiddleware.single("file")` is passed as Express middleware in `router.post("/", ..., uploadMiddleware.single("file"), handler)`, errors thrown by multer (e.g., `LIMIT_FILE_SIZE`) are passed to Express's `next()` callback, bypassing the route handler's `try/catch` entirely. Express's default error handler returns HTTP 500 with no JSON body. The client receives a generic 500 and the browser's `fetch().json()` throws "The string did not match the expected pattern" because the body isn't valid JSON.

**The Scientific Proof**: Server logs showed `MulterError: File too large` stack trace (not caught by route handler), HTTP 500 returned. Client console showed `ReferenceError: Can't find variable: showNotification` at line 2781 (a secondary bug masking the real error). The upload never even reached the route handler.

**The Resulting Rule**: Wrap multer invocation inside the route handler using `await new Promise((resolve, reject) => { multerMiddleware(req, res, (err) => err ? reject(err) : resolve()); })`. This keeps multer errors within the handler's control, allowing proper HTTP status codes (413 for file-too-large, 415 for unsupported type).

**rules.md**: none (Express middleware pattern)
