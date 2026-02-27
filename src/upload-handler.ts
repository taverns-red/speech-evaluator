/**
 * Video Upload Handler — REST endpoint for uploading pre-recorded videos.
 *
 * Accepts a video file via multipart POST, extracts audio using ffmpeg,
 * runs it through the transcription → metrics → evaluation → TTS pipeline,
 * and returns the complete evaluation result.
 *
 * Implements issues #24, #25, #26.
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { TranscriptionEngine } from "./transcription-engine.js";
import type { MetricsExtractor } from "./metrics-extractor.js";
import type { EvaluationGenerator } from "./evaluation-generator.js";
import type { TTSEngine } from "./tts-engine.js";
import type { TranscriptSegment, DeliveryMetrics } from "./types.js";

// ─── Config ──────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
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
];

// ─── Pipeline Dependencies ───────────────────────────────────────────────────────

export interface UploadPipelineDeps {
    transcriptionEngine: TranscriptionEngine;
    metricsExtractor: MetricsExtractor;
    evaluationGenerator: EvaluationGenerator;
    ttsEngine?: TTSEngine;
}

// ─── Multer Config ───────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, tmpdir());
    },
    filename: (_req, _file, cb) => {
        cb(null, `upload-${randomUUID()}`);
    },
});

const uploadMiddleware = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: MP4, WebM, MOV, AVI, MKV, MP3, WAV, M4A`));
        }
    },
});

// ─── Audio Extraction ────────────────────────────────────────────────────────────

/**
 * Extract audio from a video/audio file as raw PCM (16-bit, mono, 16kHz WAV).
 */
export function extractAudio(inputPath: string): Promise<string> {
    const outputPath = join(tmpdir(), `audio-${randomUUID()}.wav`);

    return new Promise<string>((resolve, reject) => {
        ffmpeg(inputPath)
            .noVideo()
            .audioChannels(1)
            .audioFrequency(16000)
            .audioCodec("pcm_s16le")
            .format("wav")
            .on("error", (err: Error) => reject(new Error(`Audio extraction failed: ${err.message}`)))
            .on("end", () => resolve(outputPath))
            .save(outputPath);
    });
}

/**
 * Get media duration in seconds using ffprobe.
 */
export function getMediaDuration(inputPath: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                reject(new Error(`ffprobe failed: ${err.message}`));
                return;
            }
            resolve(metadata.format.duration ?? 0);
        });
    });
}

// ─── Cleanup Helper ──────────────────────────────────────────────────────────────

async function cleanupFile(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch {
        // Ignore cleanup errors
    }
}

// ─── Logging ─────────────────────────────────────────────────────────────────────

function log(msg: string): void {
    console.log(`[UPLOAD] ${msg}`);
}

// ─── Router Factory ──────────────────────────────────────────────────────────────

export function createUploadRouter(deps: UploadPipelineDeps): Router {
    const router = Router();

    /**
     * POST /api/upload
     *
     * Accepts multipart form data with:
     * - file: video/audio file
     * - speakerName: speaker's name (required for consent)
     * - speechTitle: optional speech title
     * - projectType: optional speech project type
     * - objectives: optional project objectives
     */
    router.post("/", uploadMiddleware.single("file"), async (req: Request, res: Response) => {
        const uploadedPath = req.file?.path;
        let audioPath: string | undefined;

        try {
            // ── Validate ──
            if (!req.file) {
                res.status(400).json({ status: "error", error: "No file uploaded." });
                return;
            }

            const speakerName = req.body?.speakerName;
            if (!speakerName || typeof speakerName !== "string" || speakerName.trim().length === 0) {
                res.status(400).json({ status: "error", error: "speakerName is required." });
                return;
            }

            log(`Received: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)}MB, ${req.file.mimetype})`);

            // ── Duration ──
            let durationSeconds = 0;
            try {
                durationSeconds = await getMediaDuration(uploadedPath!);
                log(`Duration: ${durationSeconds.toFixed(1)}s`);
            } catch {
                log("Could not determine duration");
            }

            // ── Extract audio ──
            log("Extracting audio...");
            audioPath = await extractAudio(uploadedPath!);
            const audioBuffer = await fs.readFile(audioPath);
            log(`Audio extracted: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB PCM`);

            // ── Transcribe ──
            log("Transcribing...");
            const transcript: TranscriptSegment[] = await deps.transcriptionEngine.finalize(audioBuffer);
            log(`Transcription: ${transcript.length} segments`);

            if (transcript.length === 0) {
                res.status(422).json({ status: "error", error: "No speech detected in the uploaded file." });
                return;
            }

            // ── Extract metrics ──
            log("Extracting metrics...");
            const metrics: DeliveryMetrics = deps.metricsExtractor.extract(transcript);
            log(`Metrics: ${metrics.totalWords} words, ${Math.round(metrics.wordsPerMinute)} WPM`);

            // ── Generate evaluation ──
            log("Generating evaluation...");
            const evalConfig = req.body?.speechTitle || req.body?.projectType
                ? {
                    speechTitle: req.body.speechTitle,
                    projectType: req.body.projectType,
                    objectives: req.body.objectives,
                }
                : undefined;

            const { evaluation, passRate } = await deps.evaluationGenerator.generate(
                transcript,
                metrics,
                evalConfig,
                null, // no visual observations for uploaded video (yet)
            );
            log(`Evaluation: ${evaluation.items.length} items, pass rate ${(passRate * 100).toFixed(0)}%`);

            // ── Render script ──
            const script = deps.evaluationGenerator.renderScript(evaluation, undefined, metrics);

            // ── TTS (optional) ──
            let ttsAudioBase64: string | undefined;
            if (deps.ttsEngine) {
                try {
                    log("Synthesizing TTS...");
                    const ttsBuffer = await deps.ttsEngine.synthesize(script);
                    ttsAudioBase64 = ttsBuffer.toString("base64");
                    log(`TTS: ${(ttsBuffer.length / 1024).toFixed(0)}KB`);
                } catch (ttsErr) {
                    log(`TTS skipped: ${ttsErr instanceof Error ? ttsErr.message : String(ttsErr)}`);
                }
            }

            // ── Response ──
            res.json({
                status: "success",
                durationSeconds,
                transcript,
                metrics,
                evaluation,
                passRate,
                script,
                ...(ttsAudioBase64 ? { ttsAudio: ttsAudioBase64 } : {}),
            });

            log(`Done — ${transcript.length} segments, ${durationSeconds.toFixed(1)}s`);

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log(`Error: ${errMsg}`);

            if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
                res.status(413).json({ status: "error", error: `File too large. Maximum: ${MAX_FILE_SIZE_MB}MB.` });
                return;
            }

            res.status(500).json({ status: "error", error: errMsg });
        } finally {
            if (uploadedPath) await cleanupFile(uploadedPath);
            if (audioPath) await cleanupFile(audioPath);
        }
    });

    return router;
}
