# ADR-001: Composition Root Pattern for Dependency Injection

**Status**: Accepted
**Date**: 2026-01-15 (documented retroactively 2026-03-21)

## Context

The speech evaluator has 10+ pipeline components (TranscriptionEngine, MetricsExtractor, EvaluationGenerator, TTSEngine, VideoProcessor, VADMonitor, etc.) that need to be wired together. Many depend on external services (Deepgram, OpenAI, GCS, Firebase).

Testing requires replacing any external dependency with a mock. Early prototypes had components creating their own dependencies internally, making testing difficult.

## Decision

Use a **composition root** pattern: `index.ts` is the only file that creates concrete instances. All other modules depend on **interfaces** (TypeScript types), never on concrete implementations.

Pipeline components receive their dependencies via constructor injection:
```typescript
// SessionManager doesn't know about Deepgram or OpenAI
const sessionManager = new SessionManager({
  transcriptionEngine,  // interface, not concrete
  metricsExtractor,     // interface, not concrete
  evaluationGenerator,  // interface, not concrete
  ttsEngine,            // interface, not concrete
  ...
});
```

## Consequences

**Positive**:
- Any component can be tested in complete isolation with simple mocks
- External services never appear in test files (no nock, no service stubs)
- Adding a new pipeline stage doesn't modify existing components
- 1849 tests run in ~20 seconds with zero network calls

**Negative**:
- `index.ts` is verbose (295 lines of wiring)
- Type-only dependencies (`as unknown as InterfaceName`) can be cumbersome
- New developers must understand the wiring before navigating the codebase

## Alternatives Considered

1. **Service locator / DI container** — Too heavy for a single-server app. The wiring is simple enough to be explicit.
2. **Module-level singletons** — Convenient but untestable without `jest.mock()` hacks.
3. **Factory functions** — Used selectively (e.g., `vadMonitorFactory`, `videoProcessorFactory`) where runtime creation is needed.
