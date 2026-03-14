/**
 * Tests for GCS Upload Service.
 *
 * Uses a mock GCSClient to verify business logic without real GCS calls.
 */

import { describe, it, expect, vi } from "vitest";
import { GCSUploadService, type GCSClient } from "./gcs-upload.js";

// ─── Mock GCS Client ─────────────────────────────────────────────────────────────

function createMockClient(): GCSClient {
    return {
        generateSignedUploadUrl: vi.fn().mockResolvedValue("https://storage.googleapis.com/signed-url"),
        downloadToPath: vi.fn().mockResolvedValue(undefined),
        deleteObject: vi.fn().mockResolvedValue(undefined),
    };
}

// ─── generateSignedUploadUrl ─────────────────────────────────────────────────────

describe("GCSUploadService.generateSignedUploadUrl", () => {
    it("should return a signed URL and object ID for valid input", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        const result = await service.generateSignedUploadUrl("test.mp4", "video/mp4", 1024);

        expect(result.uploadUrl).toBe("https://storage.googleapis.com/signed-url");
        expect(result.objectId).toMatch(/^uploads\/[0-9a-f-]+\/test.mp4$/);
        expect(client.generateSignedUploadUrl).toHaveBeenCalledOnce();
    });

    it("should reject unsupported MIME types", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        await expect(
            service.generateSignedUploadUrl("file.exe", "application/x-msdownload", 1024),
        ).rejects.toThrow("Unsupported file type");
    });

    it("should reject files exceeding max size", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client, { maxUploadSizeBytes: 100 });

        await expect(
            service.generateSignedUploadUrl("big.mp4", "video/mp4", 200),
        ).rejects.toThrow("File too large");
    });

    it("should sanitize filenames in object IDs", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        const result = await service.generateSignedUploadUrl(
            "my video (final).mov",
            "video/quicktime",
            1024,
        );

        // Spaces and parens should be replaced with underscores
        expect(result.objectId).toMatch(/my_video__final_.mov$/);
    });

    it("should truncate long filenames to 100 characters", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        const longName = "a".repeat(200) + ".mp4";
        const result = await service.generateSignedUploadUrl(longName, "video/mp4", 1024);

        // objectId = "uploads/{uuid}/{truncated}" — filename part should be <= 100 chars
        const filenamePart = result.objectId.split("/").pop()!;
        expect(filenamePart.length).toBeLessThanOrEqual(100);
    });

    it("should accept all allowed MIME types", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        const allowedTypes = [
            "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
            "video/x-matroska", "audio/mpeg", "audio/wav", "audio/x-wav",
            "audio/webm", "audio/mp4", "audio/x-m4a",
        ];

        for (const mimeType of allowedTypes) {
            const result = await service.generateSignedUploadUrl("file", mimeType, 1024);
            expect(result.uploadUrl).toBeDefined();
        }
    });
});

// ─── downloadToTmpdir ────────────────────────────────────────────────────────────

describe("GCSUploadService.downloadToTmpdir", () => {
    it("should download to tmpdir and preserve file extension", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        const path = await service.downloadToTmpdir("uploads/abc/video.mp4");

        expect(path).toMatch(/\.mp4$/);
        expect(client.downloadToPath).toHaveBeenCalledWith(
            "uploads/abc/video.mp4",
            expect.stringContaining("gcs-download-"),
        );
    });

    it("should handle objects with no extension", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        const path = await service.downloadToTmpdir("uploads/abc/noext");

        expect(path).not.toMatch(/\.\w+$/); // no extension
    });
});

// ─── deleteObject ────────────────────────────────────────────────────────────────

describe("GCSUploadService.deleteObject", () => {
    it("should delegate to client.deleteObject", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        await service.deleteObject("uploads/abc/file.mp4");

        expect(client.deleteObject).toHaveBeenCalledWith("uploads/abc/file.mp4");
    });

    it("should not throw if object does not exist", async () => {
        const client = createMockClient();
        const service = new GCSUploadService(client);

        // deleteObject should be safe to call even if not found
        await expect(service.deleteObject("nonexistent")).resolves.toBeUndefined();
    });
});
