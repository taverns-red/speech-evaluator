# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 1.0.0 (2026-03-14)


### Features

* add camera flip button for mobile front/rear camera switching ([#51](https://github.com/rservant/speech-evaluator/issues/51)) ([a46190f](https://github.com/rservant/speech-evaluator/commit/a46190ff3043338906d93aa788aa6a67051a3274))
* add CI/CD deploy job to GitHub Actions workflow ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([891c1b1](https://github.com/rservant/speech-evaluator/commit/891c1b1a7dc20d1dd648d2b72add6874155de145))
* add download evaluation button to upload flow ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([9eba51e](https://github.com/rservant/speech-evaluator/commit/9eba51ef7300abb3147116a630a392a7ec6456bb))
* add Firebase Auth with email allowlist ([#37](https://github.com/rservant/speech-evaluator/issues/37)) ([aedcc3c](https://github.com/rservant/speech-evaluator/commit/aedcc3c79c701bb1ee31e15fcd73092e6c187750))
* Add iMessage notification workflow and remove outdated macOS native skill documentation. ([1fffcdd](https://github.com/rservant/speech-evaluator/commit/1fffcdd29ca891e52358cd1a5c11b7119fd56dc0))
* add light/dark theme toggle with localStorage persistence ([#56](https://github.com/rservant/speech-evaluator/issues/56)) ([ab37336](https://github.com/rservant/speech-evaluator/commit/ab373361029fce50f1cfe8597ea07819fde7db03))
* add PWA manifest with proportional icons ([#39](https://github.com/rservant/speech-evaluator/issues/39)) ([972f237](https://github.com/rservant/speech-evaluator/commit/972f2371b12634797b9f52468fb904ccc1b842dc))
* add Red Taverns branding — favicon and footer ([#45](https://github.com/rservant/speech-evaluator/issues/45)) ([864a8fe](https://github.com/rservant/speech-evaluator/commit/864a8feb841244048d27e85c71b74d9105ba7bf1))
* add semver versioning with dynamic footer display ([#15](https://github.com/rservant/speech-evaluator/issues/15)) ([fa2d3f0](https://github.com/rservant/speech-evaluator/commit/fa2d3f067e091279a27ff1fe608f49b0d4418d82))
* add stub face/pose detectors and wire into SessionManager ([#21](https://github.com/rservant/speech-evaluator/issues/21), [#22](https://github.com/rservant/speech-evaluator/issues/22), [#23](https://github.com/rservant/speech-evaluator/issues/23)) ([c05bd66](https://github.com/rservant/speech-evaluator/commit/c05bd66fda8e6282ebf1f98529e8932b92ea1dd9))
* add video/audio upload endpoint with offline pipeline ([#24](https://github.com/rservant/speech-evaluator/issues/24), [#25](https://github.com/rservant/speech-evaluator/issues/25), [#26](https://github.com/rservant/speech-evaluator/issues/26)) ([53f25a1](https://github.com/rservant/speech-evaluator/commit/53f25a1e201dfd9affff5aa8412f0b10653cd02d))
* **ai-toastmasters-evaluator:** Add initial specification and design documentation ([2c7be8c](https://github.com/rservant/speech-evaluator/commit/2c7be8cee83d5685ed44dfbcfa0dbe8148d85f2f))
* **ai-toastmasters-evaluator:** Implement core evaluation engine with TypeScript ([c85077c](https://github.com/rservant/speech-evaluator/commit/c85077c969f27886293ec101a71550a21c169da6))
* **audio-capture:** Add audio level metering and server initialization ([b1e2930](https://github.com/rservant/speech-evaluator/commit/b1e2930e37b5246a8847444bf682ba4a50802281))
* display user info in page banner ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([81340fa](https://github.com/rservant/speech-evaluator/commit/81340fa9382030b981ab24bd630159e27bc8d930))
* download evaluation outputs as ZIP on save ([#55](https://github.com/rservant/speech-evaluator/issues/55)) ([c3cafd2](https://github.com/rservant/speech-evaluator/commit/c3cafd29d47e75fdc735543417c7316f2ea0015a))
* **eager-evaluation-pipeline:** Implement core eager pipeline with deferred promises and cache validity ([3472a55](https://github.com/rservant/speech-evaluator/commit/3472a553611f7bda667879a68787c62ba79e94fe))
* Establish core engineering workflows for TDD and pre-task orientation with dedicated rule documentation. ([bf40415](https://github.com/rservant/speech-evaluator/commit/bf40415183fe5c6f3e1b6345fdfb74ae0e8276b8))
* extend req.user with name and picture from JWT ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([0c6c88f](https://github.com/rservant/speech-evaluator/commit/0c6c88f30d638cdcea53e6e4bfdf30668cb6bacb))
* include TTS audio in download ZIP ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([1ecea1b](https://github.com/rservant/speech-evaluator/commit/1ecea1bde26e705b34bc8139c47da069b7dc76d7))
* persist form state across page refreshes via localStorage ([#58](https://github.com/rservant/speech-evaluator/issues/58)) ([0f0afec](https://github.com/rservant/speech-evaluator/commit/0f0afec0b69d98592904e9a88981e68c8e171ec6))
* Phase 3 — Semi-Automation (VAD, Project Context, Evidence UI) ([76bcb53](https://github.com/rservant/speech-evaluator/commit/76bcb539e33a19def4c7241a232553bf0969e006))
* **phase-2-core:** Implement consent management, tone checking, and metrics enhancement ([f4b970b](https://github.com/rservant/speech-evaluator/commit/f4b970b1c462968abaf6f9512a2b1034b1343428))
* **phase-3-semi-automation:** Implement VAD monitoring, project context, and evidence UI ([5edf64a](https://github.com/rservant/speech-evaluator/commit/5edf64a4a31370e7cc6c67fbb299a697eff7953a))
* **phase-4-video-processor:** Implement video processing pipeline with frame codec, queue, sampler, and processor ([908fd8f](https://github.com/rservant/speech-evaluator/commit/908fd8fc2f4b9b6805a87bb1868b4d75c41a553d))
* **pipeline:** Wire up complete evaluation pipeline with all dependencies ([91962d9](https://github.com/rservant/speech-evaluator/commit/91962d9fd48af5bcd91629ff80e7e485e095c76e))
* **processing-indicator:** Simplify pipeline stage updates and initialize video processor ([46543e4](https://github.com/rservant/speech-evaluator/commit/46543e4b0f0a8176c6a4c5f1f0cc90ac5ff080a3))
* **redaction:** Disable third-party name redaction, update tests and docs ([c7f26f4](https://github.com/rservant/speech-evaluator/commit/c7f26f480d601f3e14d58631e674b548d82015fe))
* rename application from AI Toastmasters Evaluator to AI Speech Evaluator ([5f948a0](https://github.com/rservant/speech-evaluator/commit/5f948a0525b761cea24884cce5985673fa3b1ff3))
* replace stub detectors with real ML (BlazeFace + MoveNet via TF.js WASM) ([7d2a15b](https://github.com/rservant/speech-evaluator/commit/7d2a15b359c74e41daf171cc5c2d41ecbdf34a25)), closes [#27](https://github.com/rservant/speech-evaluator/issues/27)
* **tts-audio-delivery:** Send TTS audio as raw binary frames instead of JSON ([938b8b4](https://github.com/rservant/speech-evaluator/commit/938b8b4e7c577e6941dd3c2205dfdb8c7e9425f2))
* **tts-audio-replay-and-save:** Add TTS audio caching, replay, and persistence ([9ebb3bf](https://github.com/rservant/speech-evaluator/commit/9ebb3bf877edbcda015d392a618d8d5b754a85df))
* **tts-audio-replay-and-save:** Complete TTS audio caching, replay, and persistence ([f128fd1](https://github.com/rservant/speech-evaluator/commit/f128fd14c73170a51a902d7dd356b1c339b03d3f))
* **tts-autoplay-policy:** Enhance audio element priming with AudioContext unlock ([a482420](https://github.com/rservant/speech-evaluator/commit/a4824205e8ea394cf08269f3afdf3effd7c5d32c))
* **tts-autoplay-policy:** Implement audio element priming for browser autoplay compliance ([fdc80ae](https://github.com/rservant/speech-evaluator/commit/fdc80ae0b5478091705b9dc73d7f988c3ff6c3e7))
* **tts-playback-deferral:** Implement playback instance token and deferral state management ([dbea68f](https://github.com/rservant/speech-evaluator/commit/dbea68f16f70bf4a2570493f428bea2bb0743e39))
* **ui-logging-video-consent:** Refactor deliver button logic, enhance logging, and update video consent payload ([0bdb096](https://github.com/rservant/speech-evaluator/commit/0bdb0960398e8e94cb4bdaef5d4991fa7a773969))
* **ui-state-management:** Enable replay button when TTS audio and evaluation data are available ([27c5a18](https://github.com/rservant/speech-evaluator/commit/27c5a18a3208ad677993c964c31e66db82c029cf))
* **ui:** enlarge video preview with resize and expand toggle ([#20](https://github.com/rservant/speech-evaluator/issues/20)) ([6987d5a](https://github.com/rservant/speech-evaluator/commit/6987d5a0aea00d1edfcbbacb8dcce4a08c6feb6e))
* **ui:** extract CSS and redesign with taverns-red design system ([#12](https://github.com/rservant/speech-evaluator/issues/12)) ([5314309](https://github.com/rservant/speech-evaluator/commit/5314309499902a1edc43b09b964337501dae577d))
* **vad-integration:** Integrate VAD monitor into session manager initialization ([51de6ec](https://github.com/rservant/speech-evaluator/commit/51de6ec3f59201abeb8a9ceaa8cb57c2c0d9caab))
* **video-quality:** Fix grade computation for pose-only mode and add capabilities ([6cf3e9e](https://github.com/rservant/speech-evaluator/commit/6cf3e9ef8e4165223f3283c22e445bfa16c3e3b8))
* WebSocket auto-reconnect with exponential backoff ([#47](https://github.com/rservant/speech-evaluator/issues/47)) ([60324a6](https://github.com/rservant/speech-evaluator/commit/60324a62715c01fa3a1afabefd4562b6eb05e662))


### Bug Fixes

* add rate limiting and path traversal guard to upload handler ([81fcba9](https://github.com/rservant/speech-evaluator/commit/81fcba954040be878d50c94f360b19de9ab1e4a8))
* download button does nothing — double-encoding bug ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([39b9c16](https://github.com/rservant/speech-evaluator/commit/39b9c16620950f5edba39a7050d0a758aff495f0))
* evaluation shows only types, no content + no TTS playback ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([d82c487](https://github.com/rservant/speech-evaluator/commit/d82c4870057da341e4520d1e289f8625594b123d))
* extract version into side-effect-free module for CI ([#18](https://github.com/rservant/speech-evaluator/issues/18)) ([809fd67](https://github.com/rservant/speech-evaluator/commit/809fd674d8a85a349f5f98e438164b72399dbb93))
* footer phase label, video_stream_ready fields, var→const ([#4](https://github.com/rservant/speech-evaluator/issues/4), [#5](https://github.com/rservant/speech-evaluator/issues/5), [#6](https://github.com/rservant/speech-evaluator/issues/6)) ([319301e](https://github.com/rservant/speech-evaluator/commit/319301e9d705cb571fec1a5756ea40b30992f537))
* full page reload after sign-out to re-initialize Firebase ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([804fdc9](https://github.com/rservant/speech-evaluator/commit/804fdc9e34a168d7a8a5882932db632ae61fe67e))
* increase Cloud Run WebSocket timeout to 3600s ([#53](https://github.com/rservant/speech-evaluator/issues/53)) ([969dfa2](https://github.com/rservant/speech-evaluator/commit/969dfa22babb7e10df47dfed7c42ccda026f8ae9))
* **metrics-extractor:** Resolve type casting and initialize missing visual metrics ([0e55539](https://github.com/rservant/speech-evaluator/commit/0e55539c28a22a21c051122a3974ebcb0ee800ff))
* prevent double-click Start Speech, responsive mobile status bar, debounce consent messages ([96feafc](https://github.com/rservant/speech-evaluator/commit/96feafc62b19904645c677a99bd65aeb9137d473))
* property test uses actual bbox height for gesture threshold ([#46](https://github.com/rservant/speech-evaluator/issues/46)) ([48b086c](https://github.com/rservant/speech-evaluator/commit/48b086c7e67eb8d0bed889877f68bf4895e8ca11))
* remove Firebase API key from source control — serve from /api/config ([#50](https://github.com/rservant/speech-evaluator/issues/50)) ([9d1f565](https://github.com/rservant/speech-evaluator/commit/9d1f5654dfe6812a6786a99e21e4948c91b1e07b))
* replace innerHTML with DOM APIs in evidence highlighting ([#44](https://github.com/rservant/speech-evaluator/issues/44)) ([d91b807](https://github.com/rservant/speech-evaluator/commit/d91b8075fd226a75004bfa6d8bdad6c89ba0bb29))
* revert to signInWithPopup now that API key is correct ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([3bd809f](https://github.com/rservant/speech-evaluator/commit/3bd809f2988fc4518aed467f7e23da97a4bdaf57))
* sign-out clears Firebase Auth session via signOut() ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([2b89cdb](https://github.com/rservant/speech-evaluator/commit/2b89cdb85e31a1dc9152357660d232e759bd60b1))
* switch from signInWithPopup to signInWithRedirect ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([453c26c](https://github.com/rservant/speech-evaluator/commit/453c26c683a8e5454843abe19c7a0ca0328fb8ad))
* **transcription-engine:** Correct audio buffer conversion for OpenAI API ([5a25baa](https://github.com/rservant/speech-evaluator/commit/5a25baa12f07bf07d865f5dfd558949ab3845114))
* trim API keys and add uncaught exception handler ([#48](https://github.com/rservant/speech-evaluator/issues/48)) ([28964f3](https://github.com/rservant/speech-evaluator/commit/28964f31e007252fdfd36c16d6939d2538d3169a))
* update Firebase config with correct SDK credentials ([#37](https://github.com/rservant/speech-evaluator/issues/37)) ([682dff8](https://github.com/rservant/speech-evaluator/commit/682dff8f81a4635d5057898f0ae740f32a654783))
* upload evaluation not displayed — wrong element IDs ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([12263a8](https://github.com/rservant/speech-evaluator/commit/12263a823935a57051a3bc97b4007571e8bf5291))
* use Cloud Run readiness status instead of HTTP health check ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([499ecca](https://github.com/rservant/speech-evaluator/commit/499ecca6913534f4736e3bb6102573129adc20fa))
* use impersonate-service-account for CI health check token ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([4d23d22](https://github.com/rservant/speech-evaluator/commit/4d23d22e38bd0a9d1180c8044104cd4ff63e776b))
* use whisper-1 for upload transcription with model override and chunking ([#57](https://github.com/rservant/speech-evaluator/issues/57)) ([0ece7bd](https://github.com/rservant/speech-evaluator/commit/0ece7bd311e2df45edd52724901c2dc270a5c7cc))
* video upload fails with large files and cryptic error ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([f14ad2f](https://github.com/rservant/speech-evaluator/commit/f14ad2fc86aa8d056f145a50e8c78a1b9a424c02))


### Performance Improvements

* defer WebSocket connection until live session starts ([#59](https://github.com/rservant/speech-evaluator/issues/59)) ([32acf64](https://github.com/rservant/speech-evaluator/commit/32acf648a5453f5e5dfa939d0a909ac5c241831d))

## [0.6.0](https://github.com/rservant/speech-evaluator/compare/v0.5.0...v0.6.0) (2026-02-27)


### Features

* replace stub detectors with real ML (BlazeFace + MoveNet via TF.js WASM) ([3acfc55](https://github.com/rservant/speech-evaluator/commit/3acfc55ebcd94ce8bf0c9789829e3bb6bbaad16a)), closes [#27](https://github.com/rservant/speech-evaluator/issues/27)

## [0.5.0](https://github.com/rservant/speech-evaluator/compare/v0.4.0...v0.5.0) (2026-02-27)


### Features

* Add iMessage notification workflow and remove outdated macOS native skill documentation. ([5c2cdaa](https://github.com/rservant/speech-evaluator/commit/5c2cdaab2a58c37b21db31a3351eedec1f358cd7))
* add stub face/pose detectors and wire into SessionManager ([#21](https://github.com/rservant/speech-evaluator/issues/21), [#22](https://github.com/rservant/speech-evaluator/issues/22), [#23](https://github.com/rservant/speech-evaluator/issues/23)) ([703398a](https://github.com/rservant/speech-evaluator/commit/703398afd33db282178926fc8821058f579d48c1)), closes [#27](https://github.com/rservant/speech-evaluator/issues/27)
* add video/audio upload endpoint with offline pipeline ([#24](https://github.com/rservant/speech-evaluator/issues/24), [#25](https://github.com/rservant/speech-evaluator/issues/25), [#26](https://github.com/rservant/speech-evaluator/issues/26)) ([4e4337b](https://github.com/rservant/speech-evaluator/commit/4e4337ba0f4e5f78a29af8925b8f9de13c180ee8))
* Establish core engineering workflows for TDD and pre-task orientation with dedicated rule documentation. ([4216125](https://github.com/rservant/speech-evaluator/commit/42161259ee5ab145d27272691b130942647017e8))
* rename application from AI Toastmasters Evaluator to AI Speech Evaluator ([a970856](https://github.com/rservant/speech-evaluator/commit/a97085692efdf94e457eb81f0e5500051c9663cb)), closes [#28](https://github.com/rservant/speech-evaluator/issues/28)
* **ui:** enlarge video preview with resize and expand toggle ([#20](https://github.com/rservant/speech-evaluator/issues/20)) ([be778d6](https://github.com/rservant/speech-evaluator/commit/be778d61ca61886c1334680706e6d6beba9d1cc9))


### Bug Fixes

* extract version into side-effect-free module for CI ([#18](https://github.com/rservant/speech-evaluator/issues/18)) ([e2e408b](https://github.com/rservant/speech-evaluator/commit/e2e408b6305f695c778d98885f83b4218afc6414))
* prevent double-click Start Speech, responsive mobile status bar, debounce consent messages ([f2e73d8](https://github.com/rservant/speech-evaluator/commit/f2e73d88d35220122208b0f32275a01f87694dc8)), closes [#29](https://github.com/rservant/speech-evaluator/issues/29) [#30](https://github.com/rservant/speech-evaluator/issues/30) [#31](https://github.com/rservant/speech-evaluator/issues/31)
