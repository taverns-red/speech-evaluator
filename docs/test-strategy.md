# Test Strategy

> Living document — update when test categories or practices change.

## Overview

| Metric | Value |
|--------|-------|
| **Unit/Integration** | Vitest + fast-check |
| **E2E** | Playwright (Chromium) |
| **Unit test count** | 1971 (as of Sprint C19) |
| **E2E test count** | 13 (as of Sprint C19) |
| **Unit suite duration** | ~20s |
| **E2E suite duration** | ~8s |
| **Test location** | Units: co-located (`*.test.ts`), E2E: `e2e/` directory |

---

## Test Pyramid

```
         ╱╲
        ╱ E2E (Playwright) ╲   Page load, consent, state machine, video
       ╱────────────────────╲
      ╱    Integration       ╲   server.test.ts, upload tests
     ╱────────────────────────╲
    ╱ Unit + Property-Based    ╲  ~95% of suite
   ╱────────────────────────────╲
```

### Distribution

| Type | Files | Approx Tests | Purpose |
|------|-------|-------------|---------|
| **Unit** | `*.test.ts` | ~800 | Core logic, transformations, edge cases |
| **Property-based** | `*.property.test.ts` | ~800 | Randomized input exploration |
| **Integration** | `server.test.ts`, `server.property.test.ts` | ~100 | HTTP/WS server behavior |
| **Audio fixture** | `audio-fixtures.integration.test.ts` | 5 | Real audio through MetricsExtractor (#141) |
| **Golden shape** | `golden-shape.snapshot.test.ts` | 13 | Evaluation/metrics output shape verification (#142) |
| **E2E** | `e2e/*.spec.ts` | 13 | Browser-level: page load, consent, state machine, video (#167) |

---

## Test Type Decision Matrix

Use this when deciding what test to write:

| Scenario | Test Type | Example |
|----------|-----------|---------| 
| Pure data transformation | **Property test** | MetricsExtractor: random audio → valid metrics |
| Business rule with specific cases | **Unit test** | EvaluationGenerator: rubric threshold logic |
| API endpoint behavior | **Integration test** | Server: POST /api/upload returns 413 for large files |
| WebSocket protocol | **Integration test** | Server: connection → consent → start → stop flow |
| UI layout at viewport | **E2E test** | Page load: all JS modules serve JS, not HTML |
| Frontend state machine | **E2E test** | IDLE → RECORDING → PROCESSING transitions |
| Form persistence | **E2E test** | Consent: speaker name restored after refresh |
| Error handling | **Unit test** | TranscriptionEngine: retry on Deepgram disconnect |
| String/path manipulation | **Property test** | sanitizeForPath: arbitrary input → valid path |

---

## Testing Conventions

### File Naming
- Unit tests: `<module>.test.ts` (co-located in `src/`)
- Property tests: `<module>.property.test.ts` (co-located in `src/`)
- E2E tests: `e2e/<feature>.spec.ts`

### E2E Test Conventions
- **Auth bypass**: E2E server starts without `authMiddleware` (script: `e2e/test-server.ts`)
- **Setup wizard**: Tests set `speechEval_setupComplete` in localStorage to skip first-run wizard
- **Media mocking**: `page.addInitScript()` stubs `getUserMedia` with fake streams
- **Port**: E2E server uses port 3099 (no conflict with dev server on 3004)

### Test Organization
```typescript
describe("ModuleName", () => {
  describe("methodName", () => {
    it("should [expected behavior] when [condition]", () => {
      // Arrange → Act → Assert
    });
  });
});
```

### Mock Pattern
All external dependencies use **interface-based mocking**:
```typescript
// Source: interface defined in module
export interface GcsHistoryClient {
  saveFile(path: string, content: string | Buffer, contentType: string): Promise<void>;
  // ...
}

// Test: create mock implementing the interface
function createMockClient(): GcsHistoryClient & {
  saveFile: ReturnType<typeof vi.fn>;
} {
  return { saveFile: vi.fn().mockResolvedValue(undefined) };
}
```

### Property Test Pattern
```typescript
import { fc } from "fast-check";

it("should [invariant] for all valid inputs", () => {
  fc.assert(
    fc.property(fc.string(), fc.integer({ min: 0 }), (input, num) => {
      const result = functionUnderTest(input, num);
      // Assert invariant
      expect(result).toSatisfy(someInvariant);
    })
  );
});
```

---

## Critical Paths

These flows **must** have comprehensive test coverage:

| Path | Coverage | Key Files |
|------|----------|-----------|
| Live speech pipeline | Unit + Integration + E2E | `session-manager.test.ts`, `server.test.ts`, `e2e/state-machine.spec.ts` |
| Upload pipeline | Unit + Integration | `upload-handler.test.ts`, `server.test.ts` |
| Evaluation generation | Unit + Property | `evaluation-generator.test.ts`, `*.property.test.ts` |
| Metrics extraction | Unit + Property | `metrics-extractor.test.ts`, `*.property.test.ts` |
| GCS history CRUD | Unit | `gcs-history.test.ts` |
| Auth middleware | Unit | `auth-middleware.test.ts` |
| Page load (JS modules) | E2E | `e2e/page-load.spec.ts` |
| Consent & persistence | E2E | `e2e/consent-flow.spec.ts` |

---

## Quality Gates

### Pre-Push
```bash
npm run build    # 0 TypeScript errors
npx vitest run   # 0 test failures
```

### CI (GitHub Actions)
1. `npm ci` → `npm run build` → `npx vitest run`
2. `npx playwright install chromium` → `npm run test:e2e`
3. Trivy vulnerability scan
4. Docker build
5. Deploy to Cloud Run
6. Deployment health check

### Baseline Protection
- Test count must not decrease between sprints
- Baseline is recorded at the start of each sprint

| Sprint | Unit Baseline | E2E Baseline |
|--------|--------------|-------------|
| C6 | 1788 | — |
| C7 | 1842 | — |
| C8 | 1849 | — |
| C9 | 1867 | — |
| C19 | 1971 | 13 |
