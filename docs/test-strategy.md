# Test Strategy

> Living document — update when test categories or practices change.

## Overview

| Metric | Value |
|--------|-------|
| **Framework** | Vitest |
| **Property testing** | fast-check |
| **Test count** | 1867 (as of Sprint C9) |
| **Suite duration** | ~20s |
| **Test location** | Co-located (`*.test.ts` next to source) |

---

## Test Pyramid

```
         ╱╲
        ╱ Browser ╲       Browser verification (manual + subagent)
       ╱────────────╲
      ╱  Integration  ╲   server.test.ts, upload tests
     ╱──────────────────╲
    ╱ Unit + Property-Based ╲  ~95% of suite
   ╱──────────────────────────╲
```

### Distribution

| Type | Files | Approx Tests | Purpose |
|------|-------|-------------|---------|
| **Unit** | `*.test.ts` | ~800 | Core logic, transformations, edge cases |
| **Property-based** | `*.property.test.ts` | ~800 | Randomized input exploration |
| **Integration** | `server.test.ts`, `server.property.test.ts` | ~100 | HTTP/WS server behavior |
| **Audio fixture** | `audio-fixtures.integration.test.ts` | 5 | Real audio through MetricsExtractor (#141) |
| **Golden shape** | `golden-shape.snapshot.test.ts` | 13 | Evaluation/metrics output shape verification (#142) |
| **Browser** | Browser subagent | 3 | Visual verification, responsive layout (#143) |

---

## Test Type Decision Matrix

Use this when deciding what test to write:

| Scenario | Test Type | Example |
|----------|-----------|---------|
| Pure data transformation | **Property test** | MetricsExtractor: random audio → valid metrics |
| Business rule with specific cases | **Unit test** | EvaluationGenerator: rubric threshold logic |
| API endpoint behavior | **Integration test** | Server: POST /api/upload returns 413 for large files |
| WebSocket protocol | **Integration test** | Server: connection → consent → start → stop flow |
| UI layout at viewport | **Browser test** | Responsive: no horizontal scroll at 375px |
| Error handling | **Unit test** | TranscriptionEngine: retry on Deepgram disconnect |
| String/path manipulation | **Property test** | sanitizeForPath: arbitrary input → valid path |

---

## Testing Conventions

### File Naming
- Unit tests: `<module>.test.ts` (co-located)
- Property tests: `<module>.property.test.ts` (co-located)
- No separate `__tests__` directory

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
| Live speech pipeline | Unit + Integration | `session-manager.test.ts`, `server.test.ts` |
| Upload pipeline | Unit + Integration | `upload-handler.test.ts`, `server.test.ts` |
| Evaluation generation | Unit + Property | `evaluation-generator.test.ts`, `*.property.test.ts` |
| Metrics extraction | Unit + Property | `metrics-extractor.test.ts`, `*.property.test.ts` |
| GCS history CRUD | Unit | `gcs-history.test.ts` |
| Auth middleware | Unit | `auth-middleware.test.ts` |

---

## Known Flaky Tests

| Test | File | Cause | Status |
|------|------|-------|--------|
| `set_consent > should allow updating consent while still in IDLE` | `server.test.ts` | HTTP parse error from WS port collision in parallel | Intermittent, re-run passes |

**Policy**: Flaky tests must be fixed within 24 hours or documented here with a mitigation plan.

---

## Quality Gates

### Pre-Push
```bash
npm run build    # 0 TypeScript errors
npx vitest run   # 0 test failures
```

### CI (GitHub Actions)
1. `npm ci` → `npm run build` → `npx vitest run`
2. Trivy vulnerability scan
3. Docker build
4. Deploy to Cloud Run
5. Deployment health check

### Baseline Protection
- Test count must not decrease between sprints
- Baseline is recorded at the start of each sprint

| Sprint | Baseline |
|--------|----------|
| C6 | 1788 |
| C7 | 1842 |
| C8 | 1849 |
| C9 | 1867 |
