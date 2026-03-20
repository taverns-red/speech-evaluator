// GCS History Service tests (#123)
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GcsHistoryService,
  sanitizeForPath,
  buildEvaluationPrefix,
  type GcsHistoryClient,
  type SaveEvaluationInput,
  type EvaluationMetadata,
} from "./gcs-history.js";
import type { TranscriptSegment, DeliveryMetrics, StructuredEvaluation } from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeTranscript(): TranscriptSegment[] {
  return [
    { text: "Hello world", startTime: 0, endTime: 1, words: [{ word: "Hello", startTime: 0, endTime: 0.5, confidence: 0.95 }, { word: "world", startTime: 0.5, endTime: 1, confidence: 0.95 }], isFinal: true },
  ];
}

function makeMetrics(): DeliveryMetrics {
  return {
    durationSeconds: 60, durationFormatted: "1:00", totalWords: 120, wordsPerMinute: 120,
    fillerWords: [], fillerWordCount: 0, fillerWordFrequency: 0, pauseCount: 0,
    totalPauseDurationSeconds: 0, averagePauseDurationSeconds: 0, intentionalPauseCount: 0,
    hesitationPauseCount: 0, classifiedPauses: [], energyVariationCoefficient: 0,
    energyProfile: { windowDurationMs: 250, windows: [], coefficientOfVariation: 0, silenceThreshold: 0 },
    classifiedFillers: [], visualMetrics: null,
  };
}

function makeEvaluation(): StructuredEvaluation {
  return {
    opening: "Great speech!",
    items: [
      { type: "commendation", summary: "Good pace", explanation: "Steady WPM", evidence_quote: "Hello world", evidence_timestamp: 0 },
    ],
    closing: "Keep it up!",
    structure_commentary: { opening_comment: null, body_comment: null, closing_comment: null },
  };
}

function makeSaveInput(overrides?: Partial<SaveEvaluationInput>): SaveEvaluationInput {
  return {
    speakerName: "Jane Doe",
    speechTitle: "My First Speech",
    mode: "upload" as const,
    durationSeconds: 60,
    wordsPerMinute: 120,
    passRate: 0.8,
    transcript: makeTranscript(),
    metrics: makeMetrics(),
    evaluation: makeEvaluation(),
    evaluationScript: "Great speech! Good pace. Keep it up!",
    ttsAudio: Buffer.from([1, 2, 3, 4, 5]),
    ...overrides,
  };
}

function createMockClient(): GcsHistoryClient & {
  saveFile: ReturnType<typeof vi.fn>;
  listPrefixes: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  getSignedReadUrl: ReturnType<typeof vi.fn>;
  fileExists: ReturnType<typeof vi.fn>;
} {
  return {
    saveFile: vi.fn().mockResolvedValue(undefined),
    listPrefixes: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue("{}"),
    getSignedReadUrl: vi.fn().mockResolvedValue("https://signed-url.example.com"),
    fileExists: vi.fn().mockResolvedValue(true),
  };
}

// ─── sanitizeForPath ────────────────────────────────────────────────────────────

describe("sanitizeForPath", () => {
  it("lowercases input", () => {
    expect(sanitizeForPath("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(sanitizeForPath("my speech title")).toBe("my-speech-title");
  });

  it("removes special characters", () => {
    expect(sanitizeForPath("Hello! @World# $%")).toBe("hello-world");
  });

  it("collapses multiple hyphens", () => {
    expect(sanitizeForPath("hello---world")).toBe("hello-world");
  });

  it("trims leading/trailing hyphens", () => {
    expect(sanitizeForPath("-hello-")).toBe("hello");
  });

  it("truncates to max length", () => {
    const long = "a".repeat(100);
    expect(sanitizeForPath(long, 20).length).toBeLessThanOrEqual(20);
  });

  it("returns 'untitled' for empty input", () => {
    expect(sanitizeForPath("")).toBe("untitled");
    expect(sanitizeForPath("   ")).toBe("untitled");
    expect(sanitizeForPath("!!!")).toBe("untitled");
  });

  it("handles unicode by stripping non-ascii chars", () => {
    expect(sanitizeForPath("café résumé")).toBe("caf-rsum");
  });
});

// ─── buildEvaluationPrefix ──────────────────────────────────────────────────────

describe("buildEvaluationPrefix", () => {
  it("builds correct prefix format", () => {
    const date = new Date(2026, 2, 20, 14, 30); // March 20, 2026 2:30 PM
    const prefix = buildEvaluationPrefix("Jane Doe", "My Speech", date);

    expect(prefix).toBe("results/jane-doe/2026-03-20-1430-my-speech/");
  });

  it("uses 'untitled' for empty speech title", () => {
    const date = new Date(2026, 0, 1, 9, 0);
    const prefix = buildEvaluationPrefix("Speaker", "", date);

    expect(prefix).toContain("untitled");
  });

  it("sanitizes special characters in names", () => {
    const date = new Date(2026, 5, 15, 12, 0);
    const prefix = buildEvaluationPrefix("John O'Brien", "Speech: The Basics!", date);

    expect(prefix).toBe("results/john-obrien/2026-06-15-1200-speech-the-basics/");
  });

  it("starts with results/ prefix", () => {
    const prefix = buildEvaluationPrefix("Speaker", "Title");
    expect(prefix.startsWith("results/")).toBe(true);
  });

  it("ends with trailing slash", () => {
    const prefix = buildEvaluationPrefix("Speaker", "Title");
    expect(prefix.endsWith("/")).toBe(true);
  });
});

// ─── GcsHistoryService.saveEvaluationResults ────────────────────────────────────

describe("GcsHistoryService - saveEvaluationResults", () => {
  let client: ReturnType<typeof createMockClient>;
  let service: GcsHistoryService;

  beforeEach(() => {
    client = createMockClient();
    service = new GcsHistoryService(client);
  });

  it("saves 5 files (metadata, transcript, metrics, evaluation, audio) for complete input", async () => {
    const input = makeSaveInput();
    const prefix = await service.saveEvaluationResults(input);

    expect(prefix).not.toBeNull();
    expect(client.saveFile).toHaveBeenCalledTimes(5);

    // Verify file names
    const savedPaths = client.saveFile.mock.calls.map((c: any[]) => c[0]);
    expect(savedPaths.some((p: string) => p.endsWith("metadata.json"))).toBe(true);
    expect(savedPaths.some((p: string) => p.endsWith("transcript.json"))).toBe(true);
    expect(savedPaths.some((p: string) => p.endsWith("metrics.json"))).toBe(true);
    expect(savedPaths.some((p: string) => p.endsWith("evaluation.json"))).toBe(true);
    expect(savedPaths.some((p: string) => p.endsWith("evaluation_audio.mp3"))).toBe(true);
  });

  it("saves 4 files when no TTS audio", async () => {
    const input = makeSaveInput({ ttsAudio: undefined });
    await service.saveEvaluationResults(input);

    expect(client.saveFile).toHaveBeenCalledTimes(4);
  });

  it("saves 4 files when TTS audio is empty buffer", async () => {
    const input = makeSaveInput({ ttsAudio: Buffer.alloc(0) });
    await service.saveEvaluationResults(input);

    expect(client.saveFile).toHaveBeenCalledTimes(4);
  });

  it("metadata.json contains correct fields", async () => {
    const input = makeSaveInput({ passRate: 0.75, projectType: "persuasive" });
    await service.saveEvaluationResults(input);

    const metadataCall = client.saveFile.mock.calls.find((c: any[]) => c[0].endsWith("metadata.json"));
    expect(metadataCall).toBeDefined();

    const parsed = JSON.parse(metadataCall![1] as string) as EvaluationMetadata;
    expect(parsed.speakerName).toBe("Jane Doe");
    expect(parsed.speechTitle).toBe("My First Speech");
    expect(parsed.passRate).toBe(0.75);
    expect(parsed.projectType).toBe("persuasive");
    expect(parsed.mode).toBe("upload");
    expect(parsed.durationSeconds).toBe(60);
    expect(parsed.wordsPerMinute).toBe(120);
    expect(parsed.date).toBeTruthy();
    expect(parsed.prefix).toContain("results/jane-doe/");
  });

  it("returns null and logs on GCS error", async () => {
    client.saveFile.mockRejectedValue(new Error("GCS unavailable"));

    const input = makeSaveInput();
    const result = await service.saveEvaluationResults(input);

    expect(result).toBeNull();
  });

  it("uses correct content types", async () => {
    const input = makeSaveInput();
    await service.saveEvaluationResults(input);

    const contentTypes = client.saveFile.mock.calls.map((c: any[]) => c[2]);
    expect(contentTypes.filter((t: string) => t === "application/json").length).toBe(4);
    expect(contentTypes.filter((t: string) => t === "audio/mpeg").length).toBe(1);
  });
});

// ─── GcsHistoryService.listEvaluations ──────────────────────────────────────────

describe("GcsHistoryService - listEvaluations", () => {
  let client: ReturnType<typeof createMockClient>;
  let service: GcsHistoryService;

  beforeEach(() => {
    client = createMockClient();
    service = new GcsHistoryService(client);
  });

  it("returns empty results for speaker with no evaluations", async () => {
    client.listPrefixes.mockResolvedValue([]);

    const result = await service.listEvaluations("Jane");

    expect(result.results).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("returns evaluations sorted newest-first", async () => {
    const prefixes = [
      "results/jane/2026-01-01-0900-first/",
      "results/jane/2026-03-15-1400-third/",
      "results/jane/2026-02-10-1000-second/",
    ];
    client.listPrefixes.mockResolvedValue(prefixes);

    const metadata1: EvaluationMetadata = {
      date: "2026-01-01T09:00:00Z", speakerName: "Jane", speechTitle: "First",
      durationSeconds: 60, wordsPerMinute: 120, passRate: 0.8, mode: "upload",
      prefix: prefixes[0],
    };
    const metadata2: EvaluationMetadata = {
      date: "2026-02-10T10:00:00Z", speakerName: "Jane", speechTitle: "Second",
      durationSeconds: 120, wordsPerMinute: 130, passRate: 0.9, mode: "live",
      prefix: prefixes[2],
    };
    const metadata3: EvaluationMetadata = {
      date: "2026-03-15T14:00:00Z", speakerName: "Jane", speechTitle: "Third",
      durationSeconds: 90, wordsPerMinute: 110, passRate: 0.7, mode: "upload",
      prefix: prefixes[1],
    };

    // readFile returns metadata based on path
    client.readFile.mockImplementation((path: string) => {
      if (path.includes("third")) return JSON.stringify(metadata3);
      if (path.includes("second")) return JSON.stringify(metadata2);
      return JSON.stringify(metadata1);
    });

    const result = await service.listEvaluations("Jane");

    expect(result.results.length).toBe(3);
    // Newest first (March > February > January)
    expect(result.results[0].metadata.speechTitle).toBe("Third");
    expect(result.results[1].metadata.speechTitle).toBe("Second");
    expect(result.results[2].metadata.speechTitle).toBe("First");
  });

  it("supports pagination with limit and cursor", async () => {
    const prefixes = [
      "results/jane/2026-01-01-0900-a/",
      "results/jane/2026-02-01-0900-b/",
      "results/jane/2026-03-01-0900-c/",
    ];
    client.listPrefixes.mockResolvedValue(prefixes);

    const metaA: EvaluationMetadata = {
      date: "2026-01-01", speakerName: "Jane", speechTitle: "A",
      durationSeconds: 60, wordsPerMinute: 100, passRate: 0.5, mode: "upload", prefix: prefixes[0],
    };
    const metaB: EvaluationMetadata = { ...metaA, speechTitle: "B", prefix: prefixes[1] };
    const metaC: EvaluationMetadata = { ...metaA, speechTitle: "C", prefix: prefixes[2] };

    client.readFile.mockImplementation((path: string) => {
      if (path.includes("-c/")) return JSON.stringify(metaC);
      if (path.includes("-b/")) return JSON.stringify(metaB);
      return JSON.stringify(metaA);
    });

    // First page: limit 2
    const page1 = await service.listEvaluations("Jane", 2);
    expect(page1.results.length).toBe(2);
    expect(page1.nextCursor).toBeDefined();

    // Second page using cursor
    const page2 = await service.listEvaluations("Jane", 2, page1.nextCursor);
    expect(page2.results.length).toBe(1);
    expect(page2.nextCursor).toBeUndefined();
  });

  it("skips evaluations with corrupted metadata", async () => {
    client.listPrefixes.mockResolvedValue([
      "results/jane/2026-01-01-0900-good/",
      "results/jane/2026-02-01-0900-bad/",
    ]);

    client.readFile.mockImplementation((path: string) => {
      if (path.includes("bad")) throw new Error("Corrupted");
      return JSON.stringify({
        date: "2026-01-01", speakerName: "Jane", speechTitle: "Good",
        durationSeconds: 60, wordsPerMinute: 100, passRate: 0.5, mode: "upload",
        prefix: "results/jane/2026-01-01-0900-good/",
      });
    });

    const result = await service.listEvaluations("Jane");

    // Only the good evaluation is returned
    expect(result.results.length).toBe(1);
    expect(result.results[0].metadata.speechTitle).toBe("Good");
  });

  it("generates signed URLs for existing files", async () => {
    client.listPrefixes.mockResolvedValue(["results/jane/2026-01-01-0900-test/"]);
    client.readFile.mockResolvedValue(JSON.stringify({
      date: "2026-01-01", speakerName: "Jane", speechTitle: "Test",
      durationSeconds: 60, wordsPerMinute: 100, passRate: 0.5, mode: "upload",
      prefix: "results/jane/2026-01-01-0900-test/",
    }));
    client.fileExists.mockResolvedValue(true);
    client.getSignedReadUrl.mockResolvedValue("https://signed.example.com/file");

    const result = await service.listEvaluations("Jane");

    expect(result.results[0].urls.transcript).toBeDefined();
    expect(result.results[0].urls.metrics).toBeDefined();
    expect(result.results[0].urls.evaluation).toBeDefined();
    expect(result.results[0].urls.audio).toBeDefined();
    expect(result.results[0].urls.metadata).toBeDefined();
  });

  it("omits URLs for non-existent files", async () => {
    client.listPrefixes.mockResolvedValue(["results/jane/2026-01-01-0900-test/"]);
    client.readFile.mockResolvedValue(JSON.stringify({
      date: "2026-01-01", speakerName: "Jane", speechTitle: "Test",
      durationSeconds: 60, wordsPerMinute: 100, passRate: 0.5, mode: "upload",
      prefix: "results/jane/2026-01-01-0900-test/",
    }));

    // Only audio doesn't exist
    client.fileExists.mockImplementation((path: string) =>
      Promise.resolve(!path.endsWith(".mp3")),
    );

    const result = await service.listEvaluations("Jane");

    expect(result.results[0].urls.transcript).toBeDefined();
    expect(result.results[0].urls.audio).toBeUndefined();
  });

  it("sanitizes speaker name for prefix", async () => {
    client.listPrefixes.mockResolvedValue([]);

    await service.listEvaluations("Jane O'Brien");

    expect(client.listPrefixes).toHaveBeenCalledWith(
      "results/jane-obrien/",
      "/",
    );
  });
});
