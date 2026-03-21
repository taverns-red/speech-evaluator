# AI Speech Evaluator — Product Spec

> **What this is**: The source of truth for what the product does today, what's decided for next, and the business rules that govern behavior. Updated as features ship.
>
> **What this is NOT**: A PRD (that's `docs/PRD-AI-Toastmasters-Evaluator.md` — the aspirational vision).

---

## Product Vision

An AI-powered speech evaluation tool for Toastmasters clubs that provides **immediate, structured, evidence-based feedback** on speeches — replacing the common problem of underprepared human evaluators with consistent, high-quality evaluations.

### Core Value Proposition

After a speech ends, the system delivers a spoken and written evaluation in under 30 seconds that:
1. References specific moments from the transcript ("When you said...")
2. Balances commendations and recommendations
3. Evaluates against project-specific objectives if provided
4. Provides measurable delivery metrics (WPM, filler words, pacing)

### User Personas

| Persona | Context | Primary Need |
|---------|---------|-------------|
| **Club Operator** | Runs the evaluator at a Toastmasters meeting | One-click operation, reliable, non-disruptive |
| **Speaker** | Just finished a speech, wants feedback | Specific, actionable feedback on THIS speech |
| **Upload User** | Has a recorded speech/video to evaluate | Upload → get comprehensive evaluation back |

---

## Shipped Features (v0.6.x)

### Live Mode (Phase 1-4)

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **Live Transcription** | Real-time speech-to-text via Deepgram WebSocket | `transcription-engine.ts` |
| **Delivery Metrics** | WPM, filler words, pause patterns, pacing analysis | `metrics-extractor.ts`, `metrics-collector.ts` |
| **AI Evaluation** | GPT-4o structured evaluation with commendations/recommendations | `evaluation-generator.ts` |
| **TTS Playback** | Spoken evaluation via OpenAI TTS | `tts-engine.ts` |
| **Speaker Consent** | Verbal consent confirmation before recording | `consent.js`, consent form in `index.html` |
| **Project Context** | Speech title, project type, objectives, evaluation form upload | `consent.js`, project context form |
| **Analysis Tiers** | 4-tier system (Standard → Maximum) with GPT-4o Vision | `analysis-tiers.ts`, tier selector UI |
| **Video Capture** | Camera feed with configurable FPS for visual delivery analysis | `video.js` |
| **Vision Frames (Live)** | Low-frequency canvas snapshots sent as data URIs for Vision tiers | `video.js`, `server.ts` |
| **Meeting Roles** | Ah Counter, Timer, Grammarian, Table Topics, General Evaluator | `roles/*.ts`, `role-registry.ts` |
| **Panic Mute** | Immediate stop button that halts all capture | `app.js` |

### Upload Mode (Phase 3-4)

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **Video Upload** | GCS signed-URL two-phase upload for large files | `upload-handler.ts`, `gcs-upload.ts` |
| **Legacy Upload** | Direct multipart POST for files < 32MB | `upload-handler.ts` |
| **Frame Extraction** | FFmpeg-based frame extraction for Vision tiers | `frame-extractor.ts` |
| **Evaluation Form** | PDF/image upload → text extraction → LLM criteria | `form-extractor.ts` |

### Evaluation History (Phase 3)

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **GCS Persistence** | Transcript, metrics, evaluation, TTS audio saved to GCS | `gcs-history.ts` |
| **History Browser** | Past evaluations with expand/play/download | `history.js` |
| **Evaluation Deletion** | Delete single evaluation or all speaker history | `gcs-history.ts`, `history.js`, `server.ts` |
| **Data Retention** | Automated 90-day sweep, configurable via `DATA_RETENTION_DAYS` | `retention.ts`, `index.ts` |

### Infrastructure (Phase 7)

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **Structured Logging** | JSON logging compatible with Cloud Logging | `logger.ts` |
| **Health & Metrics** | `/api/health`, `/api/metrics` endpoints | `server.ts`, `metrics-collector.ts` |
| **Firebase Auth** | Google Sign-In with email allowlist | `auth.ts`, `server.ts` |
| **Privacy Notice** | 90-day retention notice in consent form | `index.html` |
| **Cost Metadata** | `analysisTier` + `visionFrameCount` in GCS metadata | `gcs-history.ts` |

---

## Business Rules

### Consent

| Rule | Rationale | Implementation |
|------|-----------|----------------|
| Recording does not start until operator confirms verbal consent | Legal/ethical requirement | `consent.js` — start button disabled until checkbox checked |
| Audio is never persisted to disk on the server | Privacy by design | In-memory only in `session-manager.ts` |
| Speaker name is required before recording | Needed for GCS key and evaluation context | Form validation in `consent.js` |
| Video consent is separate from audio consent | Camera is optional, higher privacy bar | Separate checkbox, disabled until audio consent given |

### Evaluation

| Rule | Rationale | Implementation |
|------|-----------|----------------|
| Evaluation must have ≥1 commendation AND ≥1 recommendation | Toastmasters sandwich method | Schema validation in `evaluation-generator.ts` |
| Project objectives are injected into the LLM prompt when provided | Evaluate against what the speaker was trying to achieve | `evaluation-generator.ts` lines 739-752 |
| Evaluation form objectives are extracted and used as criteria | Uploaded forms contain project objectives that should drive feedback | `evaluation-generator.ts` lines 761-776 |
| `completed_form` response field is returned when form uploaded | Users need their specific form filled out | LLM response schema |
| Standard tier = text-only, Enhanced+ = Vision frames | Cost-quality tradeoff | `analysis-tiers.ts` |
| Vision frames capped at tier's `maxFrames` | Prevent runaway costs | `server.ts` (live), `frame-extractor.ts` (upload) |

### Data Retention

| Rule | Rationale | Implementation |
|------|-----------|----------------|
| Default retention: 90 days | Balance usefulness vs. privacy | `retention.ts`, `DATA_RETENTION_DAYS` env var |
| Users can delete their data at any time | Privacy right | DELETE endpoints in `server.ts`, UI in `history.js` |
| Retention sweep runs daily | Automated enforcement | `index.ts` — `setInterval` + initial sweep 30s after startup |

---

## Decided for Next

### Phase 5: Real-Time Conversational AI Evaluator
- Not yet scoped — aspirational goal of real-time feedback during speech

### Phase 7 (remaining): Production Hardening
- Speaker diarization for multi-speaker scenarios
- Fault tolerance: automatic recovery from API failures
- Mobile-responsive UI for tablet operation
- Setup wizard for new clubs

### Phase 8: Advanced Coaching & Analytics
- Speech-over-speech progress tracking
- Personalized improvement plans
- Score breakdowns by category

---

## Deferred / Cut

| Feature | Reason | Date |
|---------|--------|------|
| Native GCS lifecycle policies | Application-level sweep is more accurate for metadata-based age | 2026-03-20 |
| Full OpenAI token usage tracking | Optional complexity — tier + frame count metadata sufficient for cost analysis | 2026-03-20 |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEEPGRAM_API_KEY` | — | Transcription |
| `OPENAI_API_KEY` | — | Evaluation + TTS |
| `PORT` | 3000 | Server port |
| `GCS_UPLOAD_BUCKET` | `speech-evaluator-uploads-ca` | GCS bucket for uploads + history |
| `DATA_RETENTION_DAYS` | 90 | Auto-delete evaluations older than N days |
| `RETENTION_CHECK_INTERVAL_HOURS` | 24 | How often (hours) to run the retention sweep |
| `ALLOWED_EMAILS` | — | Comma-separated email allowlist for Firebase auth |
| `FIREBASE_API_KEY` | — | Firebase client config |
