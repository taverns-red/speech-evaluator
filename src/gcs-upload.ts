/**
 * GCS Upload Helper — signed URL generation, download, and cleanup.
 *
 * Provides the server-side GCS operations for the two-phase upload flow:
 *   1. generateSignedUploadUrl() — creates a write-only signed PUT URL
 *   2. downloadToTmpdir() — downloads an object to local tmpdir for processing
 *   3. deleteObject() — removes the object after processing (called in finally blocks)
 *
 * Implements issue #66.
 */

import { Storage } from "@google-cloud/storage";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

// ─── Config ──────────────────────────────────────────────────────────────────────

const BUCKET_NAME = process.env.GCS_UPLOAD_BUCKET || "speech-evaluator-uploads-ca";
const SIGNED_URL_EXPIRY_MINUTES = 15;
const MAX_UPLOAD_SIZE_BYTES = 2048 * 1024 * 1024; // 2 GB

// ─── Allowed MIME types (same as upload-handler.ts) ──────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",     // .mov
    "video/x-msvideo",     // .avi
    "video/x-matroska",    // .mkv
    "audio/mpeg",          // .mp3
    "audio/wav",           // .wav
    "audio/x-wav",         // .wav
    "audio/webm",          // .webm audio
    "audio/mp4",           // .m4a
    "audio/x-m4a",         // .m4a
]);

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface SignedUrlResult {
    uploadUrl: string;
    objectId: string;
}

export interface GCSUploadConfig {
    bucketName?: string;
    signedUrlExpiryMinutes?: number;
    maxUploadSizeBytes?: number;
}

// ─── GCS Client Interface (for testability) ──────────────────────────────────────

export interface GCSClient {
    generateSignedUploadUrl(
        objectId: string,
        contentType: string,
        expiryMinutes: number,
        maxBytes: number,
    ): Promise<string>;
    downloadToPath(objectId: string, destPath: string): Promise<void>;
    deleteObject(objectId: string): Promise<void>;
}

// ─── Real GCS Client ─────────────────────────────────────────────────────────────

export function createGCSClient(bucketName: string = BUCKET_NAME): GCSClient {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    return {
        async generateSignedUploadUrl(
            objectId: string,
            contentType: string,
            expiryMinutes: number,
            _maxBytes: number,
        ): Promise<string> {
            const file = bucket.file(objectId);
            const [url] = await file.getSignedUrl({
                version: "v4",
                action: "write",
                expires: Date.now() + expiryMinutes * 60 * 1000,
                contentType,
                // Note: extensionHeaders like x-goog-content-length-range are NOT included
                // because they become REQUIRED on the client PUT request. Size is validated
                // server-side in generateSignedUploadUrl() before signing.
            });
            return url;
        },

        async downloadToPath(objectId: string, destPath: string): Promise<void> {
            const file = bucket.file(objectId);
            const readStream = file.createReadStream();
            const writeStream = createWriteStream(destPath);
            await pipeline(readStream, writeStream);
        },

        async deleteObject(objectId: string): Promise<void> {
            const file = bucket.file(objectId);
            await file.delete({ ignoreNotFound: true });
        },
    };
}

// ─── Upload Service ──────────────────────────────────────────────────────────────

export class GCSUploadService {
    private readonly client: GCSClient;
    private readonly config: Required<GCSUploadConfig>;

    constructor(client: GCSClient, config?: GCSUploadConfig) {
        this.client = client;
        this.config = {
            bucketName: config?.bucketName ?? BUCKET_NAME,
            signedUrlExpiryMinutes: config?.signedUrlExpiryMinutes ?? SIGNED_URL_EXPIRY_MINUTES,
            maxUploadSizeBytes: config?.maxUploadSizeBytes ?? MAX_UPLOAD_SIZE_BYTES,
        };
    }

    /**
     * Validate file metadata and generate a signed upload URL.
     *
     * @param filename - Original filename from the client
     * @param contentType - MIME type of the file
     * @param sizeBytes - File size in bytes (for pre-validation)
     * @returns Signed URL and object ID for subsequent operations
     */
    async generateSignedUploadUrl(
        filename: string,
        contentType: string,
        sizeBytes: number,
    ): Promise<SignedUrlResult> {
        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.has(contentType)) {
            throw new Error(
                `Unsupported file type: ${contentType}. Accepted: MP4, WebM, MOV, AVI, MKV, MP3, WAV, M4A`,
            );
        }

        // Validate file size
        if (sizeBytes > this.config.maxUploadSizeBytes) {
            const maxMB = Math.round(this.config.maxUploadSizeBytes / 1024 / 1024);
            throw new Error(`File too large (${Math.round(sizeBytes / 1024 / 1024)}MB). Maximum: ${maxMB}MB.`);
        }

        // Generate unique object path
        const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
        const objectId = `uploads/${randomUUID()}/${sanitizedName}`;

        const uploadUrl = await this.client.generateSignedUploadUrl(
            objectId,
            contentType,
            this.config.signedUrlExpiryMinutes,
            this.config.maxUploadSizeBytes,
        );

        return { uploadUrl, objectId };
    }

    /**
     * Download a GCS object to a temporary local file for processing.
     *
     * @param objectId - GCS object path returned from generateSignedUploadUrl
     * @returns Path to the downloaded file in tmpdir
     */
    async downloadToTmpdir(objectId: string): Promise<string> {
        // Extract extension from objectId for ffmpeg compatibility
        const ext = objectId.includes(".") ? objectId.slice(objectId.lastIndexOf(".")) : "";
        const destPath = join(tmpdir(), `gcs-download-${randomUUID()}${ext}`);
        await this.client.downloadToPath(objectId, destPath);
        return destPath;
    }

    /**
     * Delete a GCS object. Safe to call even if the object doesn't exist.
     * Should be called in finally blocks after processing completes.
     *
     * @param objectId - GCS object path to delete
     */
    async deleteObject(objectId: string): Promise<void> {
        await this.client.deleteObject(objectId);
    }
}
