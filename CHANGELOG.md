# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.6.13](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.12...ai-speech-evaluator-v0.6.13) (2026-03-15)


### Bug Fixes

* speed/ETA shows Calculating... immediately, reduced min delta to 0.2s ([#105](https://github.com/rservant/speech-evaluator/issues/105)) ([e68035f](https://github.com/rservant/speech-evaluator/commit/e68035ff9b631400184b2371d6f4755db87fefba))

## [0.6.12](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.11...ai-speech-evaluator-v0.6.12) (2026-03-15)


### Features

* accept uploaded evaluation forms to guide evaluation ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([0755950](https://github.com/rservant/speech-evaluator/commit/0755950a63a8897c70ba0b7b2ecee349a8a7cca9))
* add AI Ah-Counter role — first meeting role implementation ([#73](https://github.com/rservant/speech-evaluator/issues/73)) ([58ce18e](https://github.com/rservant/speech-evaluator/commit/58ce18e9e9848404767d477b333fd9ece39316bc))
* add camera flip button for mobile front/rear camera switching ([#51](https://github.com/rservant/speech-evaluator/issues/51)) ([a46190f](https://github.com/rservant/speech-evaluator/commit/a46190ff3043338906d93aa788aa6a67051a3274))
* add CI/CD deploy job to GitHub Actions workflow ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([891c1b1](https://github.com/rservant/speech-evaluator/commit/891c1b1a7dc20d1dd648d2b72add6874155de145))
* add download evaluation button to upload flow ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([9eba51e](https://github.com/rservant/speech-evaluator/commit/9eba51ef7300abb3147116a630a392a7ec6456bb))
* add Firebase Auth with email allowlist ([#37](https://github.com/rservant/speech-evaluator/issues/37)) ([aedcc3c](https://github.com/rservant/speech-evaluator/commit/aedcc3c79c701bb1ee31e15fcd73092e6c187750))
* add GCS signed URL uploads for large video files ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([27c9186](https://github.com/rservant/speech-evaluator/commit/27c9186f4bf029f7f62a8622624a683fcd8ff8d9))
* add General Evaluator role — meeting-level meta-evaluation ([#78](https://github.com/rservant/speech-evaluator/issues/78)) ([438b441](https://github.com/rservant/speech-evaluator/commit/438b4412692c911f9c240d97880d2dfaf91b69ae))
* add Grammarian role — LLM-based grammar analysis with fallback ([#75](https://github.com/rservant/speech-evaluator/issues/75)) ([5be59f3](https://github.com/rservant/speech-evaluator/commit/5be59f3cc80f2b2cfa9d674268326a7cf421fa34))
* Add iMessage notification workflow and remove outdated macOS native skill documentation. ([1fffcdd](https://github.com/rservant/speech-evaluator/commit/1fffcdd29ca891e52358cd1a5c11b7119fd56dc0))
* add light/dark theme toggle with localStorage persistence ([#56](https://github.com/rservant/speech-evaluator/issues/56)) ([ab37336](https://github.com/rservant/speech-evaluator/commit/ab373361029fce50f1cfe8597ea07819fde7db03))
* add MeetingRole interface and RoleRegistry ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([e4f55a1](https://github.com/rservant/speech-evaluator/commit/e4f55a115ef87e83335d2c62e63c9de112172460))
* add PWA manifest with proportional icons ([#39](https://github.com/rservant/speech-evaluator/issues/39)) ([972f237](https://github.com/rservant/speech-evaluator/commit/972f2371b12634797b9f52468fb904ccc1b842dc))
* add Red Taverns branding — favicon and footer ([#45](https://github.com/rservant/speech-evaluator/issues/45)) ([864a8fe](https://github.com/rservant/speech-evaluator/commit/864a8feb841244048d27e85c71b74d9105ba7bf1))
* add semver versioning with dynamic footer display ([#15](https://github.com/rservant/speech-evaluator/issues/15)) ([fa2d3f0](https://github.com/rservant/speech-evaluator/commit/fa2d3f067e091279a27ff1fe608f49b0d4418d82))
* add ServiceRegistry for typed dependency injection ([#86](https://github.com/rservant/speech-evaluator/issues/86)) ([e71b072](https://github.com/rservant/speech-evaluator/commit/e71b072e41275593610c0d3b36c7467dc45629e3))
* add stub face/pose detectors and wire into SessionManager ([#21](https://github.com/rservant/speech-evaluator/issues/21), [#22](https://github.com/rservant/speech-evaluator/issues/22), [#23](https://github.com/rservant/speech-evaluator/issues/23)) ([c05bd66](https://github.com/rservant/speech-evaluator/commit/c05bd66fda8e6282ebf1f98529e8932b92ea1dd9))
* add Table Topics Evaluator role — impromptu speech evaluation ([#77](https://github.com/rservant/speech-evaluator/issues/77)) ([8b01309](https://github.com/rservant/speech-evaluator/commit/8b01309af74bb279737949c8b224aefff35ff513))
* add Table Topics Master role — LLM-based prompt generation ([#76](https://github.com/rservant/speech-evaluator/issues/76)) ([4b7633d](https://github.com/rservant/speech-evaluator/commit/4b7633db28689bad0c26a000c0076e3e0127703b))
* add Timer role — deterministic timing analysis with zone classification ([#74](https://github.com/rservant/speech-evaluator/issues/74)) ([69cf3be](https://github.com/rservant/speech-evaluator/commit/69cf3bedc9726d7855e2492c7449487a35c6ba6e))
* add video/audio upload endpoint with offline pipeline ([#24](https://github.com/rservant/speech-evaluator/issues/24), [#25](https://github.com/rservant/speech-evaluator/issues/25), [#26](https://github.com/rservant/speech-evaluator/issues/26)) ([53f25a1](https://github.com/rservant/speech-evaluator/commit/53f25a1e201dfd9affff5aa8412f0b10653cd02d))
* **ai-toastmasters-evaluator:** Add initial specification and design documentation ([2c7be8c](https://github.com/rservant/speech-evaluator/commit/2c7be8cee83d5685ed44dfbcfa0dbe8148d85f2f))
* **ai-toastmasters-evaluator:** Implement core evaluation engine with TypeScript ([c85077c](https://github.com/rservant/speech-evaluator/commit/c85077c969f27886293ec101a71550a21c169da6))
* **audio-capture:** Add audio level metering and server initialization ([b1e2930](https://github.com/rservant/speech-evaluator/commit/b1e2930e37b5246a8847444bf682ba4a50802281))
* capture live speech audio via MediaRecorder for download ZIP ([#60](https://github.com/rservant/speech-evaluator/issues/60)) ([6ea0102](https://github.com/rservant/speech-evaluator/commit/6ea0102b5d09207af06f5a7d21566341f8738378))
* configurable Firebase auth domain via FIREBASE_AUTH_DOMAIN env var ([#70](https://github.com/rservant/speech-evaluator/issues/70)) ([c4ef851](https://github.com/rservant/speech-evaluator/commit/c4ef8518393ac71020706cbcb49852d00f8f6601))
* display user info in page banner ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([81340fa](https://github.com/rservant/speech-evaluator/commit/81340fa9382030b981ab24bd630159e27bc8d930))
* download evaluation outputs as ZIP on save ([#55](https://github.com/rservant/speech-evaluator/issues/55)) ([c3cafd2](https://github.com/rservant/speech-evaluator/commit/c3cafd29d47e75fdc735543417c7316f2ea0015a))
* **eager-evaluation-pipeline:** Implement core eager pipeline with deferred promises and cache validity ([3472a55](https://github.com/rservant/speech-evaluator/commit/3472a553611f7bda667879a68787c62ba79e94fe))
* Establish core engineering workflows for TDD and pre-task orientation with dedicated rule documentation. ([bf40415](https://github.com/rservant/speech-evaluator/commit/bf40415183fe5c6f3e1b6345fdfb74ae0e8276b8))
* extend req.user with name and picture from JWT ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([0c6c88f](https://github.com/rservant/speech-evaluator/commit/0c6c88f30d638cdcea53e6e4bfdf30668cb6bacb))
* externalize LLM prompts into template files ([#82](https://github.com/rservant/speech-evaluator/issues/82)) ([aa4cb96](https://github.com/rservant/speech-evaluator/commit/aa4cb96cbd913cc8dc6521cd020479f7a46621e6))
* extract shared EvaluationPipeline service ([#79](https://github.com/rservant/speech-evaluator/issues/79)) ([dd2111a](https://github.com/rservant/speech-evaluator/commit/dd2111accda6e9548abb6222428c293ec341d30f))
* include TTS audio in download ZIP ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([1ecea1b](https://github.com/rservant/speech-evaluator/commit/1ecea1bde26e705b34bc8139c47da069b7dc76d7))
* integrate roles into server and frontend ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([ab31310](https://github.com/rservant/speech-evaluator/commit/ab31310ff81409e42ee9e024b4bd69ff471ccced))
* introduce typed EventBus for pipeline decoupling ([#83](https://github.com/rservant/speech-evaluator/issues/83)) ([cfc3e3a](https://github.com/rservant/speech-evaluator/commit/cfc3e3a74864ca35a23e044790f3ced98d530184))
* persist form state across page refreshes via localStorage ([#58](https://github.com/rservant/speech-evaluator/issues/58)) ([0f0afec](https://github.com/rservant/speech-evaluator/commit/0f0afec0b69d98592904e9a88981e68c8e171ec6))
* Phase 3 — Semi-Automation (VAD, Project Context, Evidence UI) ([76bcb53](https://github.com/rservant/speech-evaluator/commit/76bcb539e33a19def4c7241a232553bf0969e006))
* **phase-2-core:** Implement consent management, tone checking, and metrics enhancement ([f4b970b](https://github.com/rservant/speech-evaluator/commit/f4b970b1c462968abaf6f9512a2b1034b1343428))
* **phase-3-semi-automation:** Implement VAD monitoring, project context, and evidence UI ([5edf64a](https://github.com/rservant/speech-evaluator/commit/5edf64a4a31370e7cc6c67fbb299a697eff7953a))
* **phase-4-video-processor:** Implement video processing pipeline with frame codec, queue, sampler, and processor ([908fd8f](https://github.com/rservant/speech-evaluator/commit/908fd8fc2f4b9b6805a87bb1868b4d75c41a553d))
* **pipeline:** Wire up complete evaluation pipeline with all dependencies ([91962d9](https://github.com/rservant/speech-evaluator/commit/91962d9fd48af5bcd91629ff80e7e485e095c76e))
* **processing-indicator:** Simplify pipeline stage updates and initialize video processor ([46543e4](https://github.com/rservant/speech-evaluator/commit/46543e4b0f0a8176c6a4c5f1f0cc90ac5ff080a3))
* **redaction:** Disable third-party name redaction, update tests and docs ([c7f26f4](https://github.com/rservant/speech-evaluator/commit/c7f26f480d601f3e14d58631e674b548d82015fe))
* register Table Topics Master, Evaluator, and General Evaluator ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([88593a3](https://github.com/rservant/speech-evaluator/commit/88593a35b30976e2fe3d3d18e5e70c745901a02f))
* register Timer and Grammarian roles in RoleRegistry ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([96a4401](https://github.com/rservant/speech-evaluator/commit/96a4401e30be8de27e2e0598429d629994975cba))
* rename application from AI Toastmasters Evaluator to AI Speech Evaluator ([5f948a0](https://github.com/rservant/speech-evaluator/commit/5f948a0525b761cea24884cce5985673fa3b1ff3))
* replace stub detectors with real ML (BlazeFace + MoveNet via TF.js WASM) ([7d2a15b](https://github.com/rservant/speech-evaluator/commit/7d2a15b359c74e41daf171cc5c2d41ecbdf34a25)), closes [#27](https://github.com/rservant/speech-evaluator/issues/27)
* responsive video preview with mirror transform and light theme ([#49](https://github.com/rservant/speech-evaluator/issues/49)) ([2f88afc](https://github.com/rservant/speech-evaluator/commit/2f88afcc97fa52a768b1b1026e25e309dcd468c7))
* split frontend into ES modules ([#80](https://github.com/rservant/speech-evaluator/issues/80)) ([d6d95b9](https://github.com/rservant/speech-evaluator/commit/d6d95b9c25bf9f63c4161ab524ea252295e44349))
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
* upload pipeline stepper with animated steps ([#96](https://github.com/rservant/speech-evaluator/issues/96)) ([bbf2d3e](https://github.com/rservant/speech-evaluator/commit/bbf2d3e939ff7407e61db9cb90a974343475bae7))
* upload progress UX — speed, ETA, elapsed timer, cancel, retry ([#95](https://github.com/rservant/speech-evaluator/issues/95) [#97](https://github.com/rservant/speech-evaluator/issues/97) [#98](https://github.com/rservant/speech-evaluator/issues/98) [#100](https://github.com/rservant/speech-evaluator/issues/100)) ([dfe8da6](https://github.com/rservant/speech-evaluator/commit/dfe8da6b16c41b35ed0f3ee2390d79057b7988f5))
* **vad-integration:** Integrate VAD monitor into session manager initialization ([51de6ec](https://github.com/rservant/speech-evaluator/commit/51de6ec3f59201abeb8a9ceaa8cb57c2c0d9caab))
* **video-quality:** Fix grade computation for pose-only mode and add capabilities ([6cf3e9e](https://github.com/rservant/speech-evaluator/commit/6cf3e9ef8e4165223f3283c22e445bfa16c3e3b8))
* WebSocket auto-reconnect with exponential backoff ([#47](https://github.com/rservant/speech-evaluator/issues/47)) ([60324a6](https://github.com/rservant/speech-evaluator/commit/60324a62715c01fa3a1afabefd4562b6eb05e662))
* wire role pipeline execution — set_active_roles + role_results messages ([#72](https://github.com/rservant/speech-evaluator/issues/72), [#73](https://github.com/rservant/speech-evaluator/issues/73)) ([0bdcd21](https://github.com/rservant/speech-evaluator/commit/0bdcd21c960be056e515daead4e8698181a21c42))


### Bug Fixes

* add rate limiting and path traversal guard to upload handler ([81fcba9](https://github.com/rservant/speech-evaluator/commit/81fcba954040be878d50c94f360b19de9ab1e4a8))
* destructure PDFParse named export from pdf-parse ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([ed0a384](https://github.com/rservant/speech-evaluator/commit/ed0a384dcad363b2244058388ddd9225cfd3ecc3))
* download button does nothing — double-encoding bug ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([39b9c16](https://github.com/rservant/speech-evaluator/commit/39b9c16620950f5edba39a7050d0a758aff495f0))
* enforce 32MB upload limit matching Cloud Run HTTP/1.1 body size ([#65](https://github.com/rservant/speech-evaluator/issues/65)) ([ef68e20](https://github.com/rservant/speech-evaluator/commit/ef68e209262f355d242ff6bee0ee1d97282cc695))
* escape role report title and heading to prevent XSS (CodeQL [#4](https://github.com/rservant/speech-evaluator/issues/4)) ([b03a47e](https://github.com/rservant/speech-evaluator/commit/b03a47ec128ddfe806b4d868976faa5f3a8546b7))
* evaluation shows only types, no content + no TTS playback ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([d82c487](https://github.com/rservant/speech-evaluator/commit/d82c4870057da341e4520d1e289f8625594b123d))
* extract version into side-effect-free module for CI ([#18](https://github.com/rservant/speech-evaluator/issues/18)) ([809fd67](https://github.com/rservant/speech-evaluator/commit/809fd674d8a85a349f5f98e438164b72399dbb93))
* footer phase label, video_stream_ready fields, var→const ([#4](https://github.com/rservant/speech-evaluator/issues/4), [#5](https://github.com/rservant/speech-evaluator/issues/5), [#6](https://github.com/rservant/speech-evaluator/issues/6)) ([319301e](https://github.com/rservant/speech-evaluator/commit/319301e9d705cb571fec1a5756ea40b30992f537))
* full page reload after sign-out to re-initialize Firebase ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([804fdc9](https://github.com/rservant/speech-evaluator/commit/804fdc9e34a168d7a8a5882932db632ae61fe67e))
* increase Cloud Run WebSocket timeout to 3600s ([#53](https://github.com/rservant/speech-evaluator/issues/53)) ([969dfa2](https://github.com/rservant/speech-evaluator/commit/969dfa22babb7e10df47dfed7c42ccda026f8ae9))
* increase JSON body limit to 10MB for upload endpoints ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([36f270d](https://github.com/rservant/speech-evaluator/commit/36f270d1f3eb600af99e77d9b5ae11c69086972f))
* install ffmpeg in Docker runtime image ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([b060eec](https://github.com/rservant/speech-evaluator/commit/b060eec0b967bcf512784c7e8e74f687bdda5a33))
* **metrics-extractor:** Resolve type casting and initialize missing visual metrics ([0e55539](https://github.com/rservant/speech-evaluator/commit/0e55539c28a22a21c051122a3974ebcb0ee800ff))
* mode tabs, speed/ETA, and legacy upload progress tracking ([#105](https://github.com/rservant/speech-evaluator/issues/105)) ([62b1c9e](https://github.com/rservant/speech-evaluator/commit/62b1c9e1733bde9015d1062e1e64e16a3f4dc4dc))
* preserve completed_form through validation pipeline and enable legacy upload form support ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([66d0050](https://github.com/rservant/speech-evaluator/commit/66d0050dd90dbeae44f5b1f7338048dd1f38dddb))
* prevent double-click Start Speech, responsive mobile status bar, debounce consent messages ([96feafc](https://github.com/rservant/speech-evaluator/commit/96feafc62b19904645c677a99bd65aeb9137d473))
* property test uses actual bbox height for gesture threshold ([#46](https://github.com/rservant/speech-evaluator/issues/46)) ([48b086c](https://github.com/rservant/speech-evaluator/commit/48b086c7e67eb8d0bed889877f68bf4895e8ca11))
* reduce Whisper chunk size to 24MB to prevent 413 errors ([#91](https://github.com/rservant/speech-evaluator/issues/91)) ([d3868b8](https://github.com/rservant/speech-evaluator/commit/d3868b86b0890a45d318bb997c05d1a601596aae))
* remove extensionHeaders from GCS signed URL ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([e667a8f](https://github.com/rservant/speech-evaluator/commit/e667a8f449e00d1876568628ef7e7bb25fdb0bcc))
* remove Firebase API key from source control — serve from /api/config ([#50](https://github.com/rservant/speech-evaluator/issues/50)) ([9d1f565](https://github.com/rservant/speech-evaluator/commit/9d1f5654dfe6812a6786a99e21e4948c91b1e07b))
* remove release-type from action inputs — config file conflict ([8e68796](https://github.com/rservant/speech-evaluator/commit/8e687961b90fd82c6e0daf1a8a15340e4bb471ed))
* replace innerHTML with DOM APIs in evidence highlighting ([#44](https://github.com/rservant/speech-evaluator/issues/44)) ([d91b807](https://github.com/rservant/speech-evaluator/commit/d91b8075fd226a75004bfa6d8bdad6c89ba0bb29))
* revert to signInWithPopup now that API key is correct ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([3bd809f](https://github.com/rservant/speech-evaluator/commit/3bd809f2988fc4518aed467f7e23da97a4bdaf57))
* sign-out clears Firebase Auth session via signOut() ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([2b89cdb](https://github.com/rservant/speech-evaluator/commit/2b89cdb85e31a1dc9152357660d232e759bd60b1))
* switch from signInWithPopup to signInWithRedirect ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([453c26c](https://github.com/rservant/speech-evaluator/commit/453c26c683a8e5454843abe19c7a0ca0328fb8ad))
* **transcription-engine:** Correct audio buffer conversion for OpenAI API ([5a25baa](https://github.com/rservant/speech-evaluator/commit/5a25baa12f07bf07d865f5dfd558949ab3845114))
* trim API keys and add uncaught exception handler ([#48](https://github.com/rservant/speech-evaluator/issues/48)) ([28964f3](https://github.com/rservant/speech-evaluator/commit/28964f31e007252fdfd36c16d6939d2538d3169a))
* unify connection status indicators to prevent contradictory messaging ([#90](https://github.com/rservant/speech-evaluator/issues/90)) ([d6ab8cb](https://github.com/rservant/speech-evaluator/commit/d6ab8cb54676f8a41bbaa85757773aa847241456))
* update Firebase config with correct SDK credentials ([#37](https://github.com/rservant/speech-evaluator/issues/37)) ([682dff8](https://github.com/rservant/speech-evaluator/commit/682dff8f81a4635d5057898f0ae740f32a654783))
* update to pdf-parse v2 API for form extraction ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([2232e4b](https://github.com/rservant/speech-evaluator/commit/2232e4b8c2d8caa67c4aaf3c34b9062b64cceba0))
* upload evaluation not displayed — wrong element IDs ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([12263a8](https://github.com/rservant/speech-evaluator/commit/12263a823935a57051a3bc97b4007571e8bf5291))
* use Cloud Run readiness status instead of HTTP health check ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([499ecca](https://github.com/rservant/speech-evaluator/commit/499ecca6913534f4736e3bb6102573129adc20fa))
* use createRequire for CJS-only pdf-parse in ESM context ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([38fa277](https://github.com/rservant/speech-evaluator/commit/38fa2772c8b71a797e0144c09a2fa0a54be4391d))
* use impersonate-service-account for CI health check token ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([4d23d22](https://github.com/rservant/speech-evaluator/commit/4d23d22e38bd0a9d1180c8044104cd4ff63e776b))
* use whisper-1 for upload transcription with model override and chunking ([#57](https://github.com/rservant/speech-evaluator/issues/57)) ([0ece7bd](https://github.com/rservant/speech-evaluator/commit/0ece7bd311e2df45edd52724901c2dc270a5c7cc))
* video upload fails with large files and cryptic error ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([f14ad2f](https://github.com/rservant/speech-evaluator/commit/f14ad2fc86aa8d056f145a50e8c78a1b9a424c02))


### Performance Improvements

* defer WebSocket connection until live session starts ([#59](https://github.com/rservant/speech-evaluator/issues/59)) ([32acf64](https://github.com/rservant/speech-evaluator/commit/32acf648a5453f5e5dfa939d0a909ac5c241831d))

## [0.6.11](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.10...ai-speech-evaluator-v0.6.11) (2026-03-15)


### Features

* configurable Firebase auth domain via FIREBASE_AUTH_DOMAIN env var ([#70](https://github.com/rservant/speech-evaluator/issues/70)) ([c4ef851](https://github.com/rservant/speech-evaluator/commit/c4ef8518393ac71020706cbcb49852d00f8f6601))
* upload pipeline stepper with animated steps ([#96](https://github.com/rservant/speech-evaluator/issues/96)) ([bbf2d3e](https://github.com/rservant/speech-evaluator/commit/bbf2d3e939ff7407e61db9cb90a974343475bae7))

## [0.6.10](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.9...ai-speech-evaluator-v0.6.10) (2026-03-15)


### Features

* accept uploaded evaluation forms to guide evaluation ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([0755950](https://github.com/rservant/speech-evaluator/commit/0755950a63a8897c70ba0b7b2ecee349a8a7cca9))
* add AI Ah-Counter role — first meeting role implementation ([#73](https://github.com/rservant/speech-evaluator/issues/73)) ([58ce18e](https://github.com/rservant/speech-evaluator/commit/58ce18e9e9848404767d477b333fd9ece39316bc))
* add camera flip button for mobile front/rear camera switching ([#51](https://github.com/rservant/speech-evaluator/issues/51)) ([a46190f](https://github.com/rservant/speech-evaluator/commit/a46190ff3043338906d93aa788aa6a67051a3274))
* add CI/CD deploy job to GitHub Actions workflow ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([891c1b1](https://github.com/rservant/speech-evaluator/commit/891c1b1a7dc20d1dd648d2b72add6874155de145))
* add download evaluation button to upload flow ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([9eba51e](https://github.com/rservant/speech-evaluator/commit/9eba51ef7300abb3147116a630a392a7ec6456bb))
* add Firebase Auth with email allowlist ([#37](https://github.com/rservant/speech-evaluator/issues/37)) ([aedcc3c](https://github.com/rservant/speech-evaluator/commit/aedcc3c79c701bb1ee31e15fcd73092e6c187750))
* add GCS signed URL uploads for large video files ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([27c9186](https://github.com/rservant/speech-evaluator/commit/27c9186f4bf029f7f62a8622624a683fcd8ff8d9))
* add Grammarian role — LLM-based grammar analysis with fallback ([#75](https://github.com/rservant/speech-evaluator/issues/75)) ([5be59f3](https://github.com/rservant/speech-evaluator/commit/5be59f3cc80f2b2cfa9d674268326a7cf421fa34))
* Add iMessage notification workflow and remove outdated macOS native skill documentation. ([1fffcdd](https://github.com/rservant/speech-evaluator/commit/1fffcdd29ca891e52358cd1a5c11b7119fd56dc0))
* add light/dark theme toggle with localStorage persistence ([#56](https://github.com/rservant/speech-evaluator/issues/56)) ([ab37336](https://github.com/rservant/speech-evaluator/commit/ab373361029fce50f1cfe8597ea07819fde7db03))
* add MeetingRole interface and RoleRegistry ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([e4f55a1](https://github.com/rservant/speech-evaluator/commit/e4f55a115ef87e83335d2c62e63c9de112172460))
* add PWA manifest with proportional icons ([#39](https://github.com/rservant/speech-evaluator/issues/39)) ([972f237](https://github.com/rservant/speech-evaluator/commit/972f2371b12634797b9f52468fb904ccc1b842dc))
* add Red Taverns branding — favicon and footer ([#45](https://github.com/rservant/speech-evaluator/issues/45)) ([864a8fe](https://github.com/rservant/speech-evaluator/commit/864a8feb841244048d27e85c71b74d9105ba7bf1))
* add semver versioning with dynamic footer display ([#15](https://github.com/rservant/speech-evaluator/issues/15)) ([fa2d3f0](https://github.com/rservant/speech-evaluator/commit/fa2d3f067e091279a27ff1fe608f49b0d4418d82))
* add ServiceRegistry for typed dependency injection ([#86](https://github.com/rservant/speech-evaluator/issues/86)) ([e71b072](https://github.com/rservant/speech-evaluator/commit/e71b072e41275593610c0d3b36c7467dc45629e3))
* add stub face/pose detectors and wire into SessionManager ([#21](https://github.com/rservant/speech-evaluator/issues/21), [#22](https://github.com/rservant/speech-evaluator/issues/22), [#23](https://github.com/rservant/speech-evaluator/issues/23)) ([c05bd66](https://github.com/rservant/speech-evaluator/commit/c05bd66fda8e6282ebf1f98529e8932b92ea1dd9))
* add Timer role — deterministic timing analysis with zone classification ([#74](https://github.com/rservant/speech-evaluator/issues/74)) ([69cf3be](https://github.com/rservant/speech-evaluator/commit/69cf3bedc9726d7855e2492c7449487a35c6ba6e))
* add video/audio upload endpoint with offline pipeline ([#24](https://github.com/rservant/speech-evaluator/issues/24), [#25](https://github.com/rservant/speech-evaluator/issues/25), [#26](https://github.com/rservant/speech-evaluator/issues/26)) ([53f25a1](https://github.com/rservant/speech-evaluator/commit/53f25a1e201dfd9affff5aa8412f0b10653cd02d))
* **ai-toastmasters-evaluator:** Add initial specification and design documentation ([2c7be8c](https://github.com/rservant/speech-evaluator/commit/2c7be8cee83d5685ed44dfbcfa0dbe8148d85f2f))
* **ai-toastmasters-evaluator:** Implement core evaluation engine with TypeScript ([c85077c](https://github.com/rservant/speech-evaluator/commit/c85077c969f27886293ec101a71550a21c169da6))
* **audio-capture:** Add audio level metering and server initialization ([b1e2930](https://github.com/rservant/speech-evaluator/commit/b1e2930e37b5246a8847444bf682ba4a50802281))
* capture live speech audio via MediaRecorder for download ZIP ([#60](https://github.com/rservant/speech-evaluator/issues/60)) ([6ea0102](https://github.com/rservant/speech-evaluator/commit/6ea0102b5d09207af06f5a7d21566341f8738378))
* display user info in page banner ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([81340fa](https://github.com/rservant/speech-evaluator/commit/81340fa9382030b981ab24bd630159e27bc8d930))
* download evaluation outputs as ZIP on save ([#55](https://github.com/rservant/speech-evaluator/issues/55)) ([c3cafd2](https://github.com/rservant/speech-evaluator/commit/c3cafd29d47e75fdc735543417c7316f2ea0015a))
* **eager-evaluation-pipeline:** Implement core eager pipeline with deferred promises and cache validity ([3472a55](https://github.com/rservant/speech-evaluator/commit/3472a553611f7bda667879a68787c62ba79e94fe))
* Establish core engineering workflows for TDD and pre-task orientation with dedicated rule documentation. ([bf40415](https://github.com/rservant/speech-evaluator/commit/bf40415183fe5c6f3e1b6345fdfb74ae0e8276b8))
* extend req.user with name and picture from JWT ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([0c6c88f](https://github.com/rservant/speech-evaluator/commit/0c6c88f30d638cdcea53e6e4bfdf30668cb6bacb))
* externalize LLM prompts into template files ([#82](https://github.com/rservant/speech-evaluator/issues/82)) ([aa4cb96](https://github.com/rservant/speech-evaluator/commit/aa4cb96cbd913cc8dc6521cd020479f7a46621e6))
* extract shared EvaluationPipeline service ([#79](https://github.com/rservant/speech-evaluator/issues/79)) ([dd2111a](https://github.com/rservant/speech-evaluator/commit/dd2111accda6e9548abb6222428c293ec341d30f))
* include TTS audio in download ZIP ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([1ecea1b](https://github.com/rservant/speech-evaluator/commit/1ecea1bde26e705b34bc8139c47da069b7dc76d7))
* integrate roles into server and frontend ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([ab31310](https://github.com/rservant/speech-evaluator/commit/ab31310ff81409e42ee9e024b4bd69ff471ccced))
* introduce typed EventBus for pipeline decoupling ([#83](https://github.com/rservant/speech-evaluator/issues/83)) ([cfc3e3a](https://github.com/rservant/speech-evaluator/commit/cfc3e3a74864ca35a23e044790f3ced98d530184))
* persist form state across page refreshes via localStorage ([#58](https://github.com/rservant/speech-evaluator/issues/58)) ([0f0afec](https://github.com/rservant/speech-evaluator/commit/0f0afec0b69d98592904e9a88981e68c8e171ec6))
* Phase 3 — Semi-Automation (VAD, Project Context, Evidence UI) ([76bcb53](https://github.com/rservant/speech-evaluator/commit/76bcb539e33a19def4c7241a232553bf0969e006))
* **phase-2-core:** Implement consent management, tone checking, and metrics enhancement ([f4b970b](https://github.com/rservant/speech-evaluator/commit/f4b970b1c462968abaf6f9512a2b1034b1343428))
* **phase-3-semi-automation:** Implement VAD monitoring, project context, and evidence UI ([5edf64a](https://github.com/rservant/speech-evaluator/commit/5edf64a4a31370e7cc6c67fbb299a697eff7953a))
* **phase-4-video-processor:** Implement video processing pipeline with frame codec, queue, sampler, and processor ([908fd8f](https://github.com/rservant/speech-evaluator/commit/908fd8fc2f4b9b6805a87bb1868b4d75c41a553d))
* **pipeline:** Wire up complete evaluation pipeline with all dependencies ([91962d9](https://github.com/rservant/speech-evaluator/commit/91962d9fd48af5bcd91629ff80e7e485e095c76e))
* **processing-indicator:** Simplify pipeline stage updates and initialize video processor ([46543e4](https://github.com/rservant/speech-evaluator/commit/46543e4b0f0a8176c6a4c5f1f0cc90ac5ff080a3))
* **redaction:** Disable third-party name redaction, update tests and docs ([c7f26f4](https://github.com/rservant/speech-evaluator/commit/c7f26f480d601f3e14d58631e674b548d82015fe))
* register Timer and Grammarian roles in RoleRegistry ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([96a4401](https://github.com/rservant/speech-evaluator/commit/96a4401e30be8de27e2e0598429d629994975cba))
* rename application from AI Toastmasters Evaluator to AI Speech Evaluator ([5f948a0](https://github.com/rservant/speech-evaluator/commit/5f948a0525b761cea24884cce5985673fa3b1ff3))
* replace stub detectors with real ML (BlazeFace + MoveNet via TF.js WASM) ([7d2a15b](https://github.com/rservant/speech-evaluator/commit/7d2a15b359c74e41daf171cc5c2d41ecbdf34a25)), closes [#27](https://github.com/rservant/speech-evaluator/issues/27)
* responsive video preview with mirror transform and light theme ([#49](https://github.com/rservant/speech-evaluator/issues/49)) ([2f88afc](https://github.com/rservant/speech-evaluator/commit/2f88afcc97fa52a768b1b1026e25e309dcd468c7))
* split frontend into ES modules ([#80](https://github.com/rservant/speech-evaluator/issues/80)) ([d6d95b9](https://github.com/rservant/speech-evaluator/commit/d6d95b9c25bf9f63c4161ab524ea252295e44349))
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
* upload progress UX — speed, ETA, elapsed timer, cancel, retry ([#95](https://github.com/rservant/speech-evaluator/issues/95) [#97](https://github.com/rservant/speech-evaluator/issues/97) [#98](https://github.com/rservant/speech-evaluator/issues/98) [#100](https://github.com/rservant/speech-evaluator/issues/100)) ([dfe8da6](https://github.com/rservant/speech-evaluator/commit/dfe8da6b16c41b35ed0f3ee2390d79057b7988f5))
* **vad-integration:** Integrate VAD monitor into session manager initialization ([51de6ec](https://github.com/rservant/speech-evaluator/commit/51de6ec3f59201abeb8a9ceaa8cb57c2c0d9caab))
* **video-quality:** Fix grade computation for pose-only mode and add capabilities ([6cf3e9e](https://github.com/rservant/speech-evaluator/commit/6cf3e9ef8e4165223f3283c22e445bfa16c3e3b8))
* WebSocket auto-reconnect with exponential backoff ([#47](https://github.com/rservant/speech-evaluator/issues/47)) ([60324a6](https://github.com/rservant/speech-evaluator/commit/60324a62715c01fa3a1afabefd4562b6eb05e662))
* wire role pipeline execution — set_active_roles + role_results messages ([#72](https://github.com/rservant/speech-evaluator/issues/72), [#73](https://github.com/rservant/speech-evaluator/issues/73)) ([0bdcd21](https://github.com/rservant/speech-evaluator/commit/0bdcd21c960be056e515daead4e8698181a21c42))


### Bug Fixes

* add rate limiting and path traversal guard to upload handler ([81fcba9](https://github.com/rservant/speech-evaluator/commit/81fcba954040be878d50c94f360b19de9ab1e4a8))
* destructure PDFParse named export from pdf-parse ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([ed0a384](https://github.com/rservant/speech-evaluator/commit/ed0a384dcad363b2244058388ddd9225cfd3ecc3))
* download button does nothing — double-encoding bug ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([39b9c16](https://github.com/rservant/speech-evaluator/commit/39b9c16620950f5edba39a7050d0a758aff495f0))
* enforce 32MB upload limit matching Cloud Run HTTP/1.1 body size ([#65](https://github.com/rservant/speech-evaluator/issues/65)) ([ef68e20](https://github.com/rservant/speech-evaluator/commit/ef68e209262f355d242ff6bee0ee1d97282cc695))
* escape role report title and heading to prevent XSS (CodeQL [#4](https://github.com/rservant/speech-evaluator/issues/4)) ([b03a47e](https://github.com/rservant/speech-evaluator/commit/b03a47ec128ddfe806b4d868976faa5f3a8546b7))
* evaluation shows only types, no content + no TTS playback ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([d82c487](https://github.com/rservant/speech-evaluator/commit/d82c4870057da341e4520d1e289f8625594b123d))
* extract version into side-effect-free module for CI ([#18](https://github.com/rservant/speech-evaluator/issues/18)) ([809fd67](https://github.com/rservant/speech-evaluator/commit/809fd674d8a85a349f5f98e438164b72399dbb93))
* footer phase label, video_stream_ready fields, var→const ([#4](https://github.com/rservant/speech-evaluator/issues/4), [#5](https://github.com/rservant/speech-evaluator/issues/5), [#6](https://github.com/rservant/speech-evaluator/issues/6)) ([319301e](https://github.com/rservant/speech-evaluator/commit/319301e9d705cb571fec1a5756ea40b30992f537))
* full page reload after sign-out to re-initialize Firebase ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([804fdc9](https://github.com/rservant/speech-evaluator/commit/804fdc9e34a168d7a8a5882932db632ae61fe67e))
* increase Cloud Run WebSocket timeout to 3600s ([#53](https://github.com/rservant/speech-evaluator/issues/53)) ([969dfa2](https://github.com/rservant/speech-evaluator/commit/969dfa22babb7e10df47dfed7c42ccda026f8ae9))
* increase JSON body limit to 10MB for upload endpoints ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([36f270d](https://github.com/rservant/speech-evaluator/commit/36f270d1f3eb600af99e77d9b5ae11c69086972f))
* install ffmpeg in Docker runtime image ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([b060eec](https://github.com/rservant/speech-evaluator/commit/b060eec0b967bcf512784c7e8e74f687bdda5a33))
* **metrics-extractor:** Resolve type casting and initialize missing visual metrics ([0e55539](https://github.com/rservant/speech-evaluator/commit/0e55539c28a22a21c051122a3974ebcb0ee800ff))
* preserve completed_form through validation pipeline and enable legacy upload form support ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([66d0050](https://github.com/rservant/speech-evaluator/commit/66d0050dd90dbeae44f5b1f7338048dd1f38dddb))
* prevent double-click Start Speech, responsive mobile status bar, debounce consent messages ([96feafc](https://github.com/rservant/speech-evaluator/commit/96feafc62b19904645c677a99bd65aeb9137d473))
* property test uses actual bbox height for gesture threshold ([#46](https://github.com/rservant/speech-evaluator/issues/46)) ([48b086c](https://github.com/rservant/speech-evaluator/commit/48b086c7e67eb8d0bed889877f68bf4895e8ca11))
* reduce Whisper chunk size to 24MB to prevent 413 errors ([#91](https://github.com/rservant/speech-evaluator/issues/91)) ([d3868b8](https://github.com/rservant/speech-evaluator/commit/d3868b86b0890a45d318bb997c05d1a601596aae))
* remove extensionHeaders from GCS signed URL ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([e667a8f](https://github.com/rservant/speech-evaluator/commit/e667a8f449e00d1876568628ef7e7bb25fdb0bcc))
* remove Firebase API key from source control — serve from /api/config ([#50](https://github.com/rservant/speech-evaluator/issues/50)) ([9d1f565](https://github.com/rservant/speech-evaluator/commit/9d1f5654dfe6812a6786a99e21e4948c91b1e07b))
* remove release-type from action inputs — config file conflict ([8e68796](https://github.com/rservant/speech-evaluator/commit/8e687961b90fd82c6e0daf1a8a15340e4bb471ed))
* replace innerHTML with DOM APIs in evidence highlighting ([#44](https://github.com/rservant/speech-evaluator/issues/44)) ([d91b807](https://github.com/rservant/speech-evaluator/commit/d91b8075fd226a75004bfa6d8bdad6c89ba0bb29))
* revert to signInWithPopup now that API key is correct ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([3bd809f](https://github.com/rservant/speech-evaluator/commit/3bd809f2988fc4518aed467f7e23da97a4bdaf57))
* sign-out clears Firebase Auth session via signOut() ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([2b89cdb](https://github.com/rservant/speech-evaluator/commit/2b89cdb85e31a1dc9152357660d232e759bd60b1))
* switch from signInWithPopup to signInWithRedirect ([#41](https://github.com/rservant/speech-evaluator/issues/41)) ([453c26c](https://github.com/rservant/speech-evaluator/commit/453c26c683a8e5454843abe19c7a0ca0328fb8ad))
* **transcription-engine:** Correct audio buffer conversion for OpenAI API ([5a25baa](https://github.com/rservant/speech-evaluator/commit/5a25baa12f07bf07d865f5dfd558949ab3845114))
* trim API keys and add uncaught exception handler ([#48](https://github.com/rservant/speech-evaluator/issues/48)) ([28964f3](https://github.com/rservant/speech-evaluator/commit/28964f31e007252fdfd36c16d6939d2538d3169a))
* unify connection status indicators to prevent contradictory messaging ([#90](https://github.com/rservant/speech-evaluator/issues/90)) ([d6ab8cb](https://github.com/rservant/speech-evaluator/commit/d6ab8cb54676f8a41bbaa85757773aa847241456))
* update Firebase config with correct SDK credentials ([#37](https://github.com/rservant/speech-evaluator/issues/37)) ([682dff8](https://github.com/rservant/speech-evaluator/commit/682dff8f81a4635d5057898f0ae740f32a654783))
* update to pdf-parse v2 API for form extraction ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([2232e4b](https://github.com/rservant/speech-evaluator/commit/2232e4b8c2d8caa67c4aaf3c34b9062b64cceba0))
* upload evaluation not displayed — wrong element IDs ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([12263a8](https://github.com/rservant/speech-evaluator/commit/12263a823935a57051a3bc97b4007571e8bf5291))
* use Cloud Run readiness status instead of HTTP health check ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([499ecca](https://github.com/rservant/speech-evaluator/commit/499ecca6913534f4736e3bb6102573129adc20fa))
* use createRequire for CJS-only pdf-parse in ESM context ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([38fa277](https://github.com/rservant/speech-evaluator/commit/38fa2772c8b71a797e0144c09a2fa0a54be4391d))
* use impersonate-service-account for CI health check token ([#36](https://github.com/rservant/speech-evaluator/issues/36)) ([4d23d22](https://github.com/rservant/speech-evaluator/commit/4d23d22e38bd0a9d1180c8044104cd4ff63e776b))
* use whisper-1 for upload transcription with model override and chunking ([#57](https://github.com/rservant/speech-evaluator/issues/57)) ([0ece7bd](https://github.com/rservant/speech-evaluator/commit/0ece7bd311e2df45edd52724901c2dc270a5c7cc))
* video upload fails with large files and cryptic error ([#54](https://github.com/rservant/speech-evaluator/issues/54)) ([f14ad2f](https://github.com/rservant/speech-evaluator/commit/f14ad2fc86aa8d056f145a50e8c78a1b9a424c02))


### Performance Improvements

* defer WebSocket connection until live session starts ([#59](https://github.com/rservant/speech-evaluator/issues/59)) ([32acf64](https://github.com/rservant/speech-evaluator/commit/32acf648a5453f5e5dfa939d0a909ac5c241831d))

## [0.6.9](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.8...ai-speech-evaluator-v0.6.9) (2026-03-15)


### Features

* upload progress UX — speed, ETA, elapsed timer, cancel, retry ([#95](https://github.com/rservant/speech-evaluator/issues/95) [#97](https://github.com/rservant/speech-evaluator/issues/97) [#98](https://github.com/rservant/speech-evaluator/issues/98) [#100](https://github.com/rservant/speech-evaluator/issues/100)) ([dfe8da6](https://github.com/rservant/speech-evaluator/commit/dfe8da6b16c41b35ed0f3ee2390d79057b7988f5))

## [0.6.8](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.7...ai-speech-evaluator-v0.6.8) (2026-03-15)


### Features

* add Grammarian role — LLM-based grammar analysis with fallback ([#75](https://github.com/rservant/speech-evaluator/issues/75)) ([5be59f3](https://github.com/rservant/speech-evaluator/commit/5be59f3cc80f2b2cfa9d674268326a7cf421fa34))
* add Timer role — deterministic timing analysis with zone classification ([#74](https://github.com/rservant/speech-evaluator/issues/74)) ([69cf3be](https://github.com/rservant/speech-evaluator/commit/69cf3bedc9726d7855e2492c7449487a35c6ba6e))
* register Timer and Grammarian roles in RoleRegistry ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([96a4401](https://github.com/rservant/speech-evaluator/commit/96a4401e30be8de27e2e0598429d629994975cba))


### Bug Fixes

* escape role report title and heading to prevent XSS (CodeQL [#4](https://github.com/rservant/speech-evaluator/issues/4)) ([b03a47e](https://github.com/rservant/speech-evaluator/commit/b03a47ec128ddfe806b4d868976faa5f3a8546b7))

## [0.6.7](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.6...ai-speech-evaluator-v0.6.7) (2026-03-15)


### Features

* wire role pipeline execution — set_active_roles + role_results messages ([#72](https://github.com/rservant/speech-evaluator/issues/72), [#73](https://github.com/rservant/speech-evaluator/issues/73)) ([0bdcd21](https://github.com/rservant/speech-evaluator/commit/0bdcd21c960be056e515daead4e8698181a21c42))


### Bug Fixes

* reduce Whisper chunk size to 24MB to prevent 413 errors ([#91](https://github.com/rservant/speech-evaluator/issues/91)) ([d3868b8](https://github.com/rservant/speech-evaluator/commit/d3868b86b0890a45d318bb997c05d1a601596aae))
* unify connection status indicators to prevent contradictory messaging ([#90](https://github.com/rservant/speech-evaluator/issues/90)) ([d6ab8cb](https://github.com/rservant/speech-evaluator/commit/d6ab8cb54676f8a41bbaa85757773aa847241456))

## [0.6.6](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.5...ai-speech-evaluator-v0.6.6) (2026-03-15)


### Features

* add AI Ah-Counter role — first meeting role implementation ([#73](https://github.com/rservant/speech-evaluator/issues/73)) ([58ce18e](https://github.com/rservant/speech-evaluator/commit/58ce18e9e9848404767d477b333fd9ece39316bc))
* add MeetingRole interface and RoleRegistry ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([e4f55a1](https://github.com/rservant/speech-evaluator/commit/e4f55a115ef87e83335d2c62e63c9de112172460))
* integrate roles into server and frontend ([#72](https://github.com/rservant/speech-evaluator/issues/72)) ([ab31310](https://github.com/rservant/speech-evaluator/commit/ab31310ff81409e42ee9e024b4bd69ff471ccced))

## [0.6.5](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.4...ai-speech-evaluator-v0.6.5) (2026-03-15)


### Features

* add ServiceRegistry for typed dependency injection ([#86](https://github.com/rservant/speech-evaluator/issues/86)) ([e71b072](https://github.com/rservant/speech-evaluator/commit/e71b072e41275593610c0d3b36c7467dc45629e3))

## [0.6.4](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.3...ai-speech-evaluator-v0.6.4) (2026-03-15)


### Features

* externalize LLM prompts into template files ([#82](https://github.com/rservant/speech-evaluator/issues/82)) ([aa4cb96](https://github.com/rservant/speech-evaluator/commit/aa4cb96cbd913cc8dc6521cd020479f7a46621e6))
* introduce typed EventBus for pipeline decoupling ([#83](https://github.com/rservant/speech-evaluator/issues/83)) ([cfc3e3a](https://github.com/rservant/speech-evaluator/commit/cfc3e3a74864ca35a23e044790f3ced98d530184))

## [0.6.3](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.2...ai-speech-evaluator-v0.6.3) (2026-03-15)


### Features

* extract shared EvaluationPipeline service ([#79](https://github.com/rservant/speech-evaluator/issues/79)) ([dd2111a](https://github.com/rservant/speech-evaluator/commit/dd2111accda6e9548abb6222428c293ec341d30f))
* split frontend into ES modules ([#80](https://github.com/rservant/speech-evaluator/issues/80)) ([d6d95b9](https://github.com/rservant/speech-evaluator/commit/d6d95b9c25bf9f63c4161ab524ea252295e44349))

## [0.6.2](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.1...ai-speech-evaluator-v0.6.2) (2026-03-15)


### Features

* accept uploaded evaluation forms to guide evaluation ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([0755950](https://github.com/rservant/speech-evaluator/commit/0755950a63a8897c70ba0b7b2ecee349a8a7cca9))
* add GCS signed URL uploads for large video files ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([27c9186](https://github.com/rservant/speech-evaluator/commit/27c9186f4bf029f7f62a8622624a683fcd8ff8d9))
* capture live speech audio via MediaRecorder for download ZIP ([#60](https://github.com/rservant/speech-evaluator/issues/60)) ([6ea0102](https://github.com/rservant/speech-evaluator/commit/6ea0102b5d09207af06f5a7d21566341f8738378))
* responsive video preview with mirror transform and light theme ([#49](https://github.com/rservant/speech-evaluator/issues/49)) ([2f88afc](https://github.com/rservant/speech-evaluator/commit/2f88afcc97fa52a768b1b1026e25e309dcd468c7))


### Bug Fixes

* destructure PDFParse named export from pdf-parse ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([ed0a384](https://github.com/rservant/speech-evaluator/commit/ed0a384dcad363b2244058388ddd9225cfd3ecc3))
* enforce 32MB upload limit matching Cloud Run HTTP/1.1 body size ([#65](https://github.com/rservant/speech-evaluator/issues/65)) ([ef68e20](https://github.com/rservant/speech-evaluator/commit/ef68e209262f355d242ff6bee0ee1d97282cc695))
* increase JSON body limit to 10MB for upload endpoints ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([36f270d](https://github.com/rservant/speech-evaluator/commit/36f270d1f3eb600af99e77d9b5ae11c69086972f))
* install ffmpeg in Docker runtime image ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([b060eec](https://github.com/rservant/speech-evaluator/commit/b060eec0b967bcf512784c7e8e74f687bdda5a33))
* preserve completed_form through validation pipeline and enable legacy upload form support ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([66d0050](https://github.com/rservant/speech-evaluator/commit/66d0050dd90dbeae44f5b1f7338048dd1f38dddb))
* remove extensionHeaders from GCS signed URL ([#66](https://github.com/rservant/speech-evaluator/issues/66)) ([e667a8f](https://github.com/rservant/speech-evaluator/commit/e667a8f449e00d1876568628ef7e7bb25fdb0bcc))
* update to pdf-parse v2 API for form extraction ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([2232e4b](https://github.com/rservant/speech-evaluator/commit/2232e4b8c2d8caa67c4aaf3c34b9062b64cceba0))
* use createRequire for CJS-only pdf-parse in ESM context ([#64](https://github.com/rservant/speech-evaluator/issues/64)) ([38fa277](https://github.com/rservant/speech-evaluator/commit/38fa2772c8b71a797e0144c09a2fa0a54be4391d))

## [0.6.1](https://github.com/rservant/speech-evaluator/compare/ai-speech-evaluator-v0.6.0...ai-speech-evaluator-v0.6.1) (2026-03-14)


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
* remove release-type from action inputs — config file conflict ([8e68796](https://github.com/rservant/speech-evaluator/commit/8e687961b90fd82c6e0daf1a8a15340e4bb471ed))
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
