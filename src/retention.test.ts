// Retention sweep tests — TDD first (#130)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runRetentionSweep, type RetentionConfig } from "./retention.js";
import type { GcsHistoryClient } from "./gcs-history.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createMockClient(): GcsHistoryClient & {
  saveFile: ReturnType<typeof vi.fn>;
  listPrefixes: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  getSignedReadUrl: ReturnType<typeof vi.fn>;
  fileExists: ReturnType<typeof vi.fn>;
  deletePrefix: ReturnType<typeof vi.fn>;
} {
  return {
    saveFile: vi.fn().mockResolvedValue(undefined),
    listPrefixes: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue("{}"),
    getSignedReadUrl: vi.fn().mockResolvedValue("https://signed-url.example.com"),
    fileExists: vi.fn().mockResolvedValue(true),
    deletePrefix: vi.fn().mockResolvedValue(0),
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("runRetentionSweep", () => {
  let client: ReturnType<typeof createMockClient>;
  const config: RetentionConfig = { maxAgeDays: 90 };

  beforeEach(() => {
    client = createMockClient();
  });

  it("does nothing when no speakers exist", async () => {
    client.listPrefixes.mockResolvedValue([]);

    const result = await runRetentionSweep(client, config);

    expect(result.scanned).toBe(0);
    expect(result.deleted).toBe(0);
    expect(client.deletePrefix).not.toHaveBeenCalled();
  });

  it("skips evaluations younger than maxAgeDays", async () => {
    // Two speakers, each with one recent evaluation
    client.listPrefixes
      .mockResolvedValueOnce(["results/alice/"]) // speaker listing
      .mockResolvedValueOnce(["results/alice/2026-03-20-1400-test/"]); // eval listing

    client.readFile.mockResolvedValue(
      JSON.stringify({ date: daysAgo(10) }),
    );

    const result = await runRetentionSweep(client, config);

    expect(result.scanned).toBe(1);
    expect(result.deleted).toBe(0);
    expect(client.deletePrefix).not.toHaveBeenCalled();
  });

  it("deletes evaluations older than maxAgeDays", async () => {
    client.listPrefixes
      .mockResolvedValueOnce(["results/alice/"]) // speaker listing
      .mockResolvedValueOnce(["results/alice/2025-12-01-1400-old/"]) // eval listing
    ;

    client.readFile.mockResolvedValue(
      JSON.stringify({ date: daysAgo(100) }),
    );
    client.deletePrefix.mockResolvedValue(5);

    const result = await runRetentionSweep(client, config);

    expect(result.scanned).toBe(1);
    expect(result.deleted).toBe(1);
    expect(client.deletePrefix).toHaveBeenCalledWith("results/alice/2025-12-01-1400-old/");
  });

  it("handles mixed old and new evaluations", async () => {
    client.listPrefixes
      .mockResolvedValueOnce(["results/alice/"]) // speaker listing
      .mockResolvedValueOnce([
        "results/alice/2025-12-01-1400-old/",
        "results/alice/2026-03-20-1400-new/",
      ]); // eval listing

    client.readFile.mockImplementation((path: string) => {
      if (path.includes("old")) return Promise.resolve(JSON.stringify({ date: daysAgo(100) }));
      return Promise.resolve(JSON.stringify({ date: daysAgo(5) }));
    });
    client.deletePrefix.mockResolvedValue(5);

    const result = await runRetentionSweep(client, config);

    expect(result.scanned).toBe(2);
    expect(result.deleted).toBe(1);
    expect(client.deletePrefix).toHaveBeenCalledTimes(1);
    expect(client.deletePrefix).toHaveBeenCalledWith("results/alice/2025-12-01-1400-old/");
  });

  it("handles multiple speakers", async () => {
    client.listPrefixes
      .mockResolvedValueOnce(["results/alice/", "results/bob/"]) // speaker listing
      .mockResolvedValueOnce(["results/alice/2025-11-01-old/"]) // alice's evals
      .mockResolvedValueOnce(["results/bob/2026-03-15-new/"]); // bob's evals

    client.readFile.mockImplementation((path: string) => {
      if (path.includes("alice")) return Promise.resolve(JSON.stringify({ date: daysAgo(140) }));
      return Promise.resolve(JSON.stringify({ date: daysAgo(5) }));
    });
    client.deletePrefix.mockResolvedValue(4);

    const result = await runRetentionSweep(client, config);

    expect(result.scanned).toBe(2);
    expect(result.deleted).toBe(1);
    expect(client.deletePrefix).toHaveBeenCalledWith("results/alice/2025-11-01-old/");
  });

  it("skips evaluations with corrupted metadata", async () => {
    client.listPrefixes
      .mockResolvedValueOnce(["results/alice/"])
      .mockResolvedValueOnce(["results/alice/2025-01-01-bad/"]);

    client.readFile.mockRejectedValue(new Error("Corrupted"));

    const result = await runRetentionSweep(client, config);

    expect(result.scanned).toBe(1);
    expect(result.deleted).toBe(0);
    expect(client.deletePrefix).not.toHaveBeenCalled();
  });

  it("respects custom maxAgeDays", async () => {
    client.listPrefixes
      .mockResolvedValueOnce(["results/alice/"])
      .mockResolvedValueOnce(["results/alice/2026-03-10-test/"]);

    // 15 days old — older than 7 but younger than 90
    client.readFile.mockResolvedValue(JSON.stringify({ date: daysAgo(15) }));
    client.deletePrefix.mockResolvedValue(3);

    const result = await runRetentionSweep(client, { maxAgeDays: 7 });

    expect(result.deleted).toBe(1);
  });
});
