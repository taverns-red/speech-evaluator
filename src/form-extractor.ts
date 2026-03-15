/**
 * Form Extractor — extracts plaintext from uploaded evaluation forms.
 *
 * Supports:
 *   - .txt, .md → direct UTF-8 decode
 *   - .pdf → pdf-parse library
 *   - .docx → mammoth library
 *
 * Implements issue #64.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
// pdf-parse v2 exports PDFParse as a class — constructor takes { data: Uint8Array },
// getText() is async and returns { text: string }.
const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Uint8Array }) => { getText(): Promise<{ text: string }> };
};
import mammoth from "mammoth";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface FormExtractResult {
    text: string;
    /** Original format detected */
    format: "text" | "pdf" | "docx" | "unknown";
}

// ─── Supported MIME types for form files ─────────────────────────────────────────

const TEXT_MIME_TYPES = new Set([
    "text/plain",
    "text/markdown",
    "text/csv",
]);

const PDF_MIME_TYPES = new Set([
    "application/pdf",
]);

const DOCX_MIME_TYPES = new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const FORM_ALLOWED_MIME_TYPES = new Set([
    ...TEXT_MIME_TYPES,
    ...PDF_MIME_TYPES,
    ...DOCX_MIME_TYPES,
]);

// ─── Extraction ──────────────────────────────────────────────────────────────────

/**
 * Extract plaintext from a form file buffer.
 *
 * @param buffer - File contents as a Buffer
 * @param mimeType - MIME type of the file
 * @returns Extracted text and detected format
 * @throws Error if extraction fails or format is unsupported
 */
export async function extractFormText(buffer: Buffer, mimeType: string): Promise<FormExtractResult> {
    if (TEXT_MIME_TYPES.has(mimeType)) {
        return { text: buffer.toString("utf-8").trim(), format: "text" };
    }

    if (PDF_MIME_TYPES.has(mimeType)) {
        const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const parser = new PDFParse({ data: uint8 });
        const result = await parser.getText();
        const text = result.text?.trim();
        if (!text) {
            throw new Error("PDF contains no extractable text. It may be a scanned document.");
        }
        return { text, format: "pdf" };
    }

    if (DOCX_MIME_TYPES.has(mimeType)) {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value?.trim();
        if (!text) {
            throw new Error("DOCX contains no extractable text.");
        }
        return { text, format: "docx" };
    }

    throw new Error(
        `Unsupported form file type: ${mimeType}. Accepted: PDF, DOCX, TXT, Markdown`,
    );
}

/**
 * Check if a MIME type is a supported form format.
 */
export function isFormMimeType(mimeType: string): boolean {
    return FORM_ALLOWED_MIME_TYPES.has(mimeType);
}
