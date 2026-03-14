/**
 * Tests for Form Extractor.
 */

import { describe, it, expect } from "vitest";
import { extractFormText, isFormMimeType, FORM_ALLOWED_MIME_TYPES } from "./form-extractor.js";

// ─── extractFormText ─────────────────────────────────────────────────────────────

describe("extractFormText", () => {
    describe("text files", () => {
        it("should extract text from a plain text buffer", async () => {
            const buffer = Buffer.from("Speaker Name: ________\nGrade: ________", "utf-8");
            const result = await extractFormText(buffer, "text/plain");

            expect(result.text).toBe("Speaker Name: ________\nGrade: ________");
            expect(result.format).toBe("text");
        });

        it("should trim whitespace from text files", async () => {
            const buffer = Buffer.from("  \n  Hello World  \n  ", "utf-8");
            const result = await extractFormText(buffer, "text/plain");

            expect(result.text).toBe("Hello World");
        });

        it("should handle markdown files", async () => {
            const buffer = Buffer.from("# Evaluation Form\n\n- [ ] Clear purpose", "utf-8");
            const result = await extractFormText(buffer, "text/markdown");

            expect(result.text).toBe("# Evaluation Form\n\n- [ ] Clear purpose");
            expect(result.format).toBe("text");
        });
    });

    describe("unsupported types", () => {
        it("should reject unsupported MIME types", async () => {
            const buffer = Buffer.from("data");
            await expect(extractFormText(buffer, "application/x-executable")).rejects.toThrow(
                "Unsupported form file type",
            );
        });

        it("should reject image MIME types", async () => {
            const buffer = Buffer.from("data");
            await expect(extractFormText(buffer, "image/png")).rejects.toThrow(
                "Unsupported form file type",
            );
        });
    });
});

// ─── isFormMimeType ──────────────────────────────────────────────────────────────

describe("isFormMimeType", () => {
    it("should return true for supported types", () => {
        expect(isFormMimeType("text/plain")).toBe(true);
        expect(isFormMimeType("application/pdf")).toBe(true);
        expect(isFormMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    });

    it("should return false for unsupported types", () => {
        expect(isFormMimeType("image/png")).toBe(false);
        expect(isFormMimeType("video/mp4")).toBe(false);
        expect(isFormMimeType("application/zip")).toBe(false);
    });
});

// ─── FORM_ALLOWED_MIME_TYPES ─────────────────────────────────────────────────────

describe("FORM_ALLOWED_MIME_TYPES", () => {
    it("should include text, pdf, and docx types", () => {
        expect(FORM_ALLOWED_MIME_TYPES.has("text/plain")).toBe(true);
        expect(FORM_ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
        expect(FORM_ALLOWED_MIME_TYPES.has("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    });
});
