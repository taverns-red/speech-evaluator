/**
 * Video Upload Handler — REST endpoints for uploading pre-recorded videos.
 *
 * Two-phase upload flow via GCS signed URLs:
 *   1. POST /init    — validates metadata, returns a signed GCS upload URL
 *   2. POST /process — downloads from GCS, runs pipeline, returns evaluation
 *
 * The direct multipart POST / endpoint is kept as a legacy fallback for
 * files under the Cloud Run 32 MiB limit.
 *
 * Implements issues #24, #25, #26, #66.
 */

import { Router, type Request, type Response } from "express";
import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join, resolve, normalize } from "path";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import type { TranscriptionEngine } from "./transcription-engine.js";
import type { MetricsExtractor } from "./metrics-extractor.js";
import type { EvaluationGenerator } from "./evaluation-generator.js";
import type { TTSEngine } from "./tts-engine.js";
import type { TranscriptSegment, DeliveryMetrics } from "./types.js";
import { type GCSUploadService } from "./gcs-upload.js";
import { type GcsHistoryService } from "./gcs-history.js";
import { extractFormText, isFormMimeType } from "./form-extractor.js";
import { runEvaluationStages } from "./evaluation-pipeline.js";
import { createLogger } from "./logger.js";
import type { MetricsCollector } from "./metrics-collector.js";

// ─── Config ──────────────────────────────────────────────────────────────────────

const LEGACY_MAX_FILE_SIZE_MB = 32; // Legacy direct upload: Cloud Run HTTP/1.1 limit
const LEGACY_MAX_FILE_SIZE_BYTES = LEGACY_MAX_FILE_SIZE_MB * 1024 * 1024;
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
    /** GCS upload service — when provided, enables the /init + /process endpoints. */
    gcsUploadService?: GCSUploadService;
    /** GCS history service — when provided, persists evaluation results to GCS. */
    gcsHistoryService?: GcsHistoryService;
    /** Metrics collector for instrumentation (Phase 7). */
    metricsCollector?: MetricsCollector;
}

// ─── Multer Config (legacy direct upload) ────────────────────────────────────────

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
    limits: { fileSize: LEGACY_MAX_FILE_SIZE_BYTES },
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
        // Guard against path traversal — only delete files within tmpdir()
        const resolvedPath = resolve(normalize(filePath));
        const tmpRoot = resolve(tmpdir());
        if (!resolvedPath.startsWith(tmpRoot)) {
            uploadLog.warn("Refusing to delete file outside tmpdir", { filePath });
            return;
        }
        await fs.unlink(resolvedPath);
    } catch {
        // Ignore cleanup errors
    }
}

const uploadLog = createLogger("UploadHandler");

// ─── Logging ─────────────────────────────────────────────────────────────────────

function log(msg: string): void {
    uploadLog.info(msg);
}

// ─── Shared Pipeline ─────────────────────────────────────────────────────────────

/**
 * Runs the common evaluation pipeline on a local file path.
 * Used by both the legacy direct upload and the GCS two-phase flow.
 */
async function runEvaluationPipeline(
    uploadedPath: string,
    formData: { speakerName: string; speechTitle?: string; projectType?: string; objectives?: string; evaluationFormText?: string },
    deps: UploadPipelineDeps,
): Promise<{
    durationSeconds: number;
    transcript: TranscriptSegment[];
    metrics: DeliveryMetrics;
    evaluation: ReturnType<EvaluationGenerator["generate"]> extends Promise<infer R> ? R : never;
    script: string;
    ttsAudioBase64?: string;
}> {
    let audioPath: string | undefined;

    try {
        // ── Duration ──
        let durationSeconds = 0;
        try {
            durationSeconds = await getMediaDuration(uploadedPath);
            log(`Duration: ${durationSeconds.toFixed(1)}s`);
        } catch {
            log("Could not determine duration");
        }

        // ── Extract audio ──
        log("Extracting audio...");
        audioPath = await extractAudio(uploadedPath);
        const audioBuffer = await fs.readFile(audioPath);
        log(`Audio extracted: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB PCM`);

        // ── Transcribe ──
        log("Transcribing...");
        const transcript: TranscriptSegment[] = await deps.transcriptionEngine.finalize(audioBuffer, { model: "whisper-1" });
        log(`Transcription: ${transcript.length} segments`);

        if (transcript.length === 0) {
            throw Object.assign(new Error("No speech detected in the uploaded file."), { statusCode: 422 });
        }

        // ── Extract metrics ──
        log("Extracting metrics...");
        const metrics: DeliveryMetrics = deps.metricsExtractor.extract(transcript);
        log(`Metrics: ${metrics.totalWords} words, ${Math.round(metrics.wordsPerMinute)} WPM`);

        // ── Run shared evaluation pipeline (stages 1-8) ──
        log("Running evaluation pipeline...");
        const evalConfig = formData.speechTitle || formData.projectType || formData.evaluationFormText
            ? {
                speechTitle: formData.speechTitle,
                projectType: formData.projectType,
                objectives: formData.objectives ? [formData.objectives] : undefined,
                evaluationFormText: formData.evaluationFormText,
            }
            : undefined;

        deps.metricsCollector?.incrementSessions();
        const evalStartMs = Date.now();
        const pipelineResult = await runEvaluationStages(
            {
                transcript,
                metrics,
                evalConfig,
                visualObservations: null, // no visual observations for uploaded video (yet)
                log: (_level, msg) => log(msg),
            },
            {
                evaluationGenerator: deps.evaluationGenerator,
                metricsExtractor: deps.metricsExtractor,
                ttsEngine: deps.ttsEngine,
            },
        );

        if (!pipelineResult) {
            throw new Error("Evaluation pipeline returned no result");
        }

        deps.metricsCollector?.incrementEvaluations();
        deps.metricsCollector?.recordEvaluationLatency(Date.now() - evalStartMs);

        log(`Evaluation: ${pipelineResult.evaluation.items.length} items, pass rate ${(pipelineResult.passRate * 100).toFixed(0)}%`);
        if (pipelineResult.evaluation.completed_form) {
            log(`Completed form: ${pipelineResult.evaluation.completed_form.length} chars`);
        } else {
            log(`Completed form: not returned by LLM (hasForm=${!!formData.evaluationFormText})`);
        }

        let ttsAudioBase64: string | undefined;
        if (pipelineResult.ttsAudio) {
            ttsAudioBase64 = pipelineResult.ttsAudio.toString("base64");
            log(`TTS: ${(pipelineResult.ttsAudio.length / 1024).toFixed(0)}KB`);
        }

        return {
            durationSeconds,
            transcript,
            metrics,
            evaluation: { evaluation: pipelineResult.evaluation, passRate: pipelineResult.passRate },
            script: pipelineResult.scriptForTTS,
            ttsAudioBase64,
        };
    } finally {
        if (audioPath) await cleanupFile(audioPath);
    }
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────────

const uploadRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "error", error: "Too many uploads. Please try again later." },
});

// ─── Router Factory ──────────────────────────────────────────────────────────────

export function createUploadRouter(deps: UploadPipelineDeps): Router {
    const router = Router();

    // Parse JSON bodies for /init and /process endpoints
    // Limit increased to 10MB to support evaluation form base64 payloads (#64)
    router.use(express.json({ limit: "10mb" }));

    // ─── POST /init (GCS two-phase upload, step 1) ───────────────────────────────
    //
    // Returns a signed URL for direct-to-GCS upload.
    // Request body: { filename, contentType, sizeBytes, speakerName, speechTitle?, projectType?, objectives? }
    // Response: { uploadUrl, objectId }

    if (deps.gcsUploadService) {
        router.post("/init", uploadRateLimiter, async (req: Request, res: Response) => {
            try {
                const { filename, contentType, sizeBytes, speakerName } = req.body;

                // Validate required fields
                if (!filename || !contentType || !sizeBytes) {
                    res.status(400).json({
                        status: "error",
                        error: "Missing required fields: filename, contentType, sizeBytes",
                    });
                    return;
                }
                if (!speakerName || typeof speakerName !== "string" || speakerName.trim().length === 0) {
                    res.status(400).json({ status: "error", error: "speakerName is required." });
                    return;
                }

                log(`Init GCS upload: ${filename} (${(sizeBytes / 1024 / 1024).toFixed(1)}MB, ${contentType})`);

                const { uploadUrl, objectId } = await deps.gcsUploadService!.generateSignedUploadUrl(
                    filename,
                    contentType,
                    sizeBytes,
                );

                res.json({ status: "ok", uploadUrl, objectId });
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                log(`Init error: ${errMsg}`);
                res.status(400).json({ status: "error", error: errMsg });
            }
        });

        // ─── POST /process (GCS two-phase upload, step 2) ────────────────────────────
        //
        // Downloads file from GCS, runs the evaluation pipeline, deletes GCS object.
        // Request body: { objectId, speakerName, speechTitle?, projectType?, objectives? }
        // Response: { status, durationSeconds, transcript, metrics, evaluation, passRate, script, ttsAudio? }

        router.post("/process", uploadRateLimiter, async (req: Request, res: Response) => {
            const { objectId, speakerName, speechTitle, projectType, objectives } = req.body;
            let downloadedPath: string | undefined;

            try {
                // Validate required fields
                if (!objectId) {
                    res.status(400).json({ status: "error", error: "objectId is required." });
                    return;
                }
                if (!speakerName || typeof speakerName !== "string" || speakerName.trim().length === 0) {
                    res.status(400).json({ status: "error", error: "speakerName is required." });
                    return;
                }

                log(`Processing GCS object: ${objectId}`);

                // Download from GCS to tmpdir
                downloadedPath = await deps.gcsUploadService!.downloadToTmpdir(objectId);
                log(`Downloaded to: ${downloadedPath}`);

                // Extract evaluation form text if provided
                let evaluationFormText: string | undefined;
                const { evaluationFormBase64, evaluationFormMimeType } = req.body;
                if (evaluationFormBase64 && evaluationFormMimeType) {
                    try {
                        log(`Extracting form text (${evaluationFormMimeType})...`);
                        const formBuffer = Buffer.from(evaluationFormBase64, "base64");
                        const formResult = await extractFormText(formBuffer, evaluationFormMimeType);
                        evaluationFormText = formResult.text;
                        log(`Form extracted: ${formResult.format}, ${evaluationFormText.length} chars`);
                    } catch (formErr) {
                        log(`Form extraction failed: ${formErr instanceof Error ? formErr.message : String(formErr)}`);
                        // Non-fatal: continue without form
                    }
                }

                // Run shared pipeline
                const result = await runEvaluationPipeline(
                    downloadedPath,
                    { speakerName, speechTitle, projectType, objectives, evaluationFormText },
                    deps,
                );

                // Persist to GCS history (fire-and-forget)
                if (deps.gcsHistoryService) {
                    deps.gcsHistoryService.saveEvaluationResults({
                        speakerName,
                        speechTitle: speechTitle || "Untitled",
                        mode: "upload",
                        durationSeconds: result.durationSeconds,
                        wordsPerMinute: result.metrics.wordsPerMinute,
                        passRate: result.evaluation.passRate,
                        projectType,
                        transcript: result.transcript,
                        metrics: result.metrics,
                        evaluation: result.evaluation.evaluation,
                        evaluationScript: result.script,
                        ttsAudio: result.ttsAudioBase64
                            ? Buffer.from(result.ttsAudioBase64, "base64")
                            : undefined,
                    }).catch(() => { /* logged inside service */ });
                }

                // Response
                res.json({
                    status: "success",
                    durationSeconds: result.durationSeconds,
                    transcript: result.transcript,
                    metrics: result.metrics,
                    evaluation: result.evaluation.evaluation,
                    passRate: result.evaluation.passRate,
                    script: result.script,
                    ...(result.ttsAudioBase64 ? { ttsAudio: result.ttsAudioBase64 } : {}),
                });

                log(`Done — ${result.transcript.length} segments, ${result.durationSeconds.toFixed(1)}s`);

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
                log(`Process error: ${errMsg}`);
                res.status(statusCode).json({ status: "error", error: errMsg });
            } finally {
                // Always clean up: local file and GCS object
                if (downloadedPath) await cleanupFile(downloadedPath);
                if (objectId) {
                    try {
                        await deps.gcsUploadService!.deleteObject(objectId);
                        log(`Deleted GCS object: ${objectId}`);
                    } catch (deleteErr) {
                        log(`Failed to delete GCS object: ${deleteErr instanceof Error ? deleteErr.message : String(deleteErr)}`);
                    }
                }
            }
        });
    }

    // ─── POST / (Legacy direct upload — kept for files < 32 MB) ──────────────────

    router.post("/", uploadRateLimiter, async (req: Request, res: Response) => {
        // Wrap multer to catch MulterErrors (file too large, unsupported type)
        // before they escape to Express's default 500 handler.
        try {
            await new Promise<void>((resolve, reject) => {
                uploadMiddleware.single("file")(req, res, (err: unknown) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (multerErr) {
            if (multerErr instanceof multer.MulterError && multerErr.code === "LIMIT_FILE_SIZE") {
                res.status(413).json({ status: "error", error: `File too large. Maximum for direct upload: ${LEGACY_MAX_FILE_SIZE_MB}MB. Use the two-phase upload for larger files.` });
                return;
            }
            const errMsg = multerErr instanceof Error ? multerErr.message : String(multerErr);
            log(`Multer error: ${errMsg}`);
            res.status(415).json({ status: "error", error: errMsg });
            return;
        }

        const uploadedPath = req.file?.path;

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

            // Extract evaluation form text if provided
            let evaluationFormText: string | undefined;
            const { evaluationFormBase64, evaluationFormMimeType } = req.body ?? {};
            if (evaluationFormBase64 && evaluationFormMimeType) {
                try {
                    log(`Extracting form text (${evaluationFormMimeType})...`);
                    const formBuffer = Buffer.from(evaluationFormBase64, "base64");
                    const formResult = await extractFormText(formBuffer, evaluationFormMimeType);
                    evaluationFormText = formResult.text;
                    log(`Form extracted: ${formResult.format}, ${evaluationFormText.length} chars`);
                } catch (formErr) {
                    log(`Form extraction failed: ${formErr instanceof Error ? formErr.message : String(formErr)}`);
                    // Non-fatal: continue without form
                }
            }

            // Run shared pipeline
            const result = await runEvaluationPipeline(
                uploadedPath!,
                {
                    speakerName,
                    speechTitle: req.body?.speechTitle,
                    projectType: req.body?.projectType,
                    objectives: req.body?.objectives,
                    evaluationFormText,
                },
                deps,
            );

            // Persist to GCS history (fire-and-forget)
            if (deps.gcsHistoryService) {
                deps.gcsHistoryService.saveEvaluationResults({
                    speakerName,
                    speechTitle: req.body?.speechTitle || "Untitled",
                    mode: "upload",
                    durationSeconds: result.durationSeconds,
                    wordsPerMinute: result.metrics.wordsPerMinute,
                    passRate: result.evaluation.passRate,
                    projectType: req.body?.projectType,
                    transcript: result.transcript,
                    metrics: result.metrics,
                    evaluation: result.evaluation.evaluation,
                    evaluationScript: result.script,
                    ttsAudio: result.ttsAudioBase64
                        ? Buffer.from(result.ttsAudioBase64, "base64")
                        : undefined,
                }).catch(() => { /* logged inside service */ });
            }

            // ── Response ──
            res.json({
                status: "success",
                durationSeconds: result.durationSeconds,
                transcript: result.transcript,
                metrics: result.metrics,
                evaluation: result.evaluation.evaluation,
                passRate: result.evaluation.passRate,
                script: result.script,
                ...(result.ttsAudioBase64 ? { ttsAudio: result.ttsAudioBase64 } : {}),
            });

            log(`Done — ${result.transcript.length} segments, ${result.durationSeconds.toFixed(1)}s`);

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
            log(`Error: ${errMsg}`);
            res.status(statusCode).json({ status: "error", error: errMsg });
        } finally {
            if (uploadedPath) await cleanupFile(uploadedPath);
        }
    });

    return router;
}
