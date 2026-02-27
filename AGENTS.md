# AI Speech Evaluator — Project Conventions

Engineering principles are defined globally in `~/.gemini/GEMINI.md`.
This file contains **project-specific** context only.

---

## Session Startup Protocol

When beginning a new session or task in this project:

1. **Read lessons**: Review the last 5 entries in `tasks/lessons.md`
2. **Establish baseline**: Run `npx vitest run` and record the pass count (currently 1506)
3. **Identify or create an issue**: Use `gh issue list` or `gh issue create` before writing code
4. **If root cause is unknown**: Use `tasks/experiment_template.md` before implementing

---

## Available Tools

### Always Available

| Tool                    | Use Case                                                                         | Notes                     |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `gh`                    | PR management, CI/CD monitoring (`gh run list`, `gh run watch`), issue tracking  | Permanently authenticated |
| `git`                   | Version control                                                                  |                           |
| `node` / `npm` / `npx`  | Runtime, package management, script execution                                    |                           |
| `curl`                  | API health checks, endpoint testing                                              |                           |

---

## Architecture

```
speech-evaluator/
├── src/                  # TypeScript backend (all .ts files, tests co-located)
│   ├── index.ts          # Entry point — wires dependencies, starts server
│   ├── server.ts         # Express + WebSocket server
│   ├── session-manager.ts # Pipeline orchestrator (transcription → metrics → eval → TTS)
│   ├── types.ts          # Shared type definitions
│   └── *.test.ts         # Co-located test files (vitest + fast-check)
├── public/
│   ├── index.html        # Single-file frontend (inline JS, no build system)
│   └── style.css         # External CSS (taverns-red design system)
├── docs/                 # PRD and specs
├── tasks/                # Lessons learned, experiment logs
└── dist/                 # Compiled JS output (gitignored)
```

**Key design decisions:**
- Backend is TypeScript compiled to ESM (`"type": "module"`)
- Frontend is a **single HTML file with inline `<script>`** — no React, no bundler
- CSS is external in `style.css` using the taverns-red design system
- Tests use **vitest** with extensive **fast-check** property-based tests
- No database — all session data is in-memory only (privacy by design)

## Commands

```bash
npm run build          # Compile TypeScript → dist/
npm run start          # Start server (requires built dist/)
npm run test           # Run all tests (vitest run)
npm run test:watch     # Watch mode
```

## Environment

Requires `.env` with:
```
DEEPGRAM_API_KEY=...   # For live + post-speech transcription
OPENAI_API_KEY=...     # For evaluation generation + TTS
PORT=3004              # Optional, defaults to 3000
```

## Versioning

- **Source of truth**: `package.json` `version` field
- **Convention**: Each PRD phase bumps the minor version
- **Tags**: Annotated git tags `vX.Y.Z` on merge/completion
- **Footer**: Dynamically fetched from `/api/version` endpoint at runtime

| Version | Phase |
|---------|-------|
| v0.1.0 | Phase 1 — MVP |
| v0.2.0 | Phase 2 — Stability & Credibility |
| v0.3.0 | Phase 3 — Semi-Automation |
| v0.4.0 | Phase 4 — Multimodal Video + UI Overhaul |

## Branching

- `main` — stable, tagged releases
- `feature/phase-N-*` — active development branches per PRD phase

## Known Flaky Tests

- `server.test.ts > set_consent > should allow updating consent while still in IDLE`
  - Intermittent HTTP parse error (`Expected HTTP/, RTSP/ or ICE/`)
  - Cause: likely WebSocket port collision when many test files run in parallel
  - Workaround: re-run; passes on retry

## Frontend Conventions

- All JS in `index.html` uses `var`-free style (`const`/`let` only)
- CSS custom properties follow taverns-red naming (`--red-primary`, `--bg-card`, etc.)
- UI state managed via `SessionState` enum and `updateUI()` function
- No framework — vanilla DOM manipulation via cached `dom.*` references

## Quality Gates

### Pre-push (every push)

- Full test suite (vitest run)

### CI/CD Pipeline (GitHub Actions)

- Build verification (`npm run build`)
- Full test suite (`npx vitest run`)
