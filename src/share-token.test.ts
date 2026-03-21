/**
 * Tests for share-token.ts (#164)
 *
 * Tests token generation, ShareRecord creation, and GCS path helpers.
 */

import { describe, it, expect } from "vitest";
import {
  generateShareToken,
  createShareRecord,
  buildSharePath,
  buildShareIndexPath,
  type ShareRecord,
} from "./share-token.js";

describe("generateShareToken()", () => {
  it("produces a non-empty string", () => {
    const token = generateShareToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("produces URL-safe characters only (base64url)", () => {
    const token = generateShareToken();
    // base64url: alphanumeric, hyphen, underscore
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces tokens of consistent length (22 chars for 16 bytes)", () => {
    const token = generateShareToken();
    expect(token.length).toBe(22);
  });

  it("produces unique tokens across calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateShareToken());
    }
    expect(tokens.size).toBe(100);
  });

  it("always produces URL-safe strings across many calls", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateShareToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBe(22);
    }
  });
});

describe("createShareRecord()", () => {
  it("creates a ShareRecord with all required fields", () => {
    const record = createShareRecord(
      "Alice Speaker",
      "results/alice-speaker/2026-03-21-1700-title/",
    );

    expect(record.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(record.speaker).toBe("Alice Speaker");
    expect(record.evalPrefix).toBe("results/alice-speaker/2026-03-21-1700-title/");
    expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("produces unique tokens for the same input", () => {
    const r1 = createShareRecord("Alice", "prefix/");
    const r2 = createShareRecord("Alice", "prefix/");
    expect(r1.token).not.toBe(r2.token);
  });
});

describe("buildSharePath()", () => {
  it("appends share.json to the evaluation prefix", () => {
    expect(buildSharePath("results/alice/2026-03-21/")).toBe(
      "results/alice/2026-03-21/share.json",
    );
  });
});

describe("buildShareIndexPath()", () => {
  it("creates index path from token", () => {
    expect(buildShareIndexPath("abc123def456")).toBe("shares/abc123def456.json");
  });
});
