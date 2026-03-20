/**
 * GCS History Service — persist and retrieve evaluation results from GCS.
 *
 * Storage layout:
 *   gs://<bucket>/results/<speaker>/<YYYY-MM-DD-HHMM-title>/
 *     metadata.json
 *     transcript.json
 *     metrics.json
 *     evaluation.json
 *     evaluation_audio.mp3
 *
 * Implements issue #123.
 */

import { Storage, type Bucket, type File } from "@google-cloud/storage";
import { createLogger } from "./logger.js";
import type { TranscriptSegment, DeliveryMetrics, StructuredEvaluation } from "./types.js";

const log = createLogger("GcsHistory");

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface EvaluationMetadata {
  /** ISO 8601 date string */
  date: string;
  speakerName: string;
  speechTitle: string;
  durationSeconds: number;
  wordsPerMinute: number;
  passRate: number;
  projectType?: string;
  /** "live" or "upload" */
  mode: "live" | "upload";
  /** GCS prefix for this evaluation's files */
  prefix: string;
}

export interface EvaluationListItem {
  metadata: EvaluationMetadata;
  urls: {
    transcript?: string;
    metrics?: string;
    evaluation?: string;
    audio?: string;
    metadata?: string;
  };
}

export interface ListEvaluationsResult {
  results: EvaluationListItem[];
  nextCursor?: string;
}

export interface SaveEvaluationInput {
  speakerName: string;
  speechTitle: string;
  mode: "live" | "upload";
  durationSeconds: number;
  wordsPerMinute: number;
  passRate: number;
  projectType?: string;
  transcript: TranscriptSegment[];
  metrics: DeliveryMetrics;
  evaluation: StructuredEvaluation;
  evaluationScript?: string;
  ttsAudio?: Buffer;
}

// ─── GCS History Client Interface (for testability) ──────────────────────────────

export interface GcsHistoryClient {
  saveFile(path: string, content: string | Buffer, contentType: string): Promise<void>;
  listPrefixes(prefix: string, delimiter: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  getSignedReadUrl(path: string, expiryMinutes: number): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  deletePrefix(prefix: string): Promise<number>;
}

// ─── Real GCS Client ─────────────────────────────────────────────────────────────

export function createGcsHistoryClient(bucketName: string): GcsHistoryClient {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  return {
    async saveFile(path: string, content: string | Buffer, contentType: string): Promise<void> {
      const file = bucket.file(path);
      await file.save(content, { contentType, resumable: false });
    },

    async listPrefixes(prefix: string, delimiter: string): Promise<string[]> {
      const [, , apiResponse] = await bucket.getFiles({
        prefix,
        delimiter,
        autoPaginate: false,
      });
      return ((apiResponse as { prefixes?: string[] })?.prefixes ?? []);
    },

    async readFile(path: string): Promise<string> {
      const file = bucket.file(path);
      const [content] = await file.download();
      return content.toString("utf-8");
    },

    async getSignedReadUrl(path: string, expiryMinutes: number): Promise<string> {
      const file = bucket.file(path);
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiryMinutes * 60 * 1000,
      });
      return url;
    },

    async fileExists(path: string): Promise<boolean> {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      return exists;
    },

    async deletePrefix(prefix: string): Promise<number> {
      const [files] = await bucket.getFiles({ prefix });
      if (files.length === 0) return 0;
      await Promise.all(files.map(f => f.delete()));
      return files.length;
    },
  };
}

// ─── Path Helpers ────────────────────────────────────────────────────────────────

const RESULTS_PREFIX = "results/";
const SIGNED_URL_EXPIRY_MINUTES = 15;

/**
 * Sanitize a string for safe use in GCS object paths.
 * Lowercase, replace spaces and special characters with hyphens,
 * collapse multiple hyphens, trim length.
 */
export function sanitizeForPath(input: string, maxLength: number = 60): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength) || "untitled";
}

/**
 * Build the GCS prefix for an evaluation.
 * Format: results/<speaker>/<YYYY-MM-DD-HHMM-title>/
 */
export function buildEvaluationPrefix(
  speakerName: string,
  speechTitle: string,
  date: Date = new Date(),
): string {
  const sanitizedSpeaker = sanitizeForPath(speakerName);
  const sanitizedTitle = sanitizeForPath(speechTitle || "untitled");

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const timestamp = `${year}-${month}-${day}-${hours}${minutes}`;

  return `${RESULTS_PREFIX}${sanitizedSpeaker}/${timestamp}-${sanitizedTitle}/`;
}

// ─── GCS History Service ─────────────────────────────────────────────────────────

export class GcsHistoryService {
  private readonly client: GcsHistoryClient;

  constructor(client: GcsHistoryClient) {
    this.client = client;
  }

  /**
   * Persist evaluation results to GCS.
   * Fire-and-forget — errors are logged but never thrown.
   */
  async saveEvaluationResults(input: SaveEvaluationInput): Promise<string | null> {
    const prefix = buildEvaluationPrefix(input.speakerName, input.speechTitle);

    try {
      log.info("Saving evaluation results to GCS", { prefix, speaker: input.speakerName });

      // Build metadata
      const metadata: EvaluationMetadata = {
        date: new Date().toISOString(),
        speakerName: input.speakerName,
        speechTitle: input.speechTitle || "Untitled",
        durationSeconds: input.durationSeconds,
        wordsPerMinute: input.wordsPerMinute,
        passRate: input.passRate,
        projectType: input.projectType,
        mode: input.mode,
        prefix,
      };

      // Save all files in parallel
      const saves: Promise<void>[] = [
        this.client.saveFile(
          `${prefix}metadata.json`,
          JSON.stringify(metadata, null, 2),
          "application/json",
        ),
        this.client.saveFile(
          `${prefix}transcript.json`,
          JSON.stringify(input.transcript, null, 2),
          "application/json",
        ),
        this.client.saveFile(
          `${prefix}metrics.json`,
          JSON.stringify(input.metrics, null, 2),
          "application/json",
        ),
        this.client.saveFile(
          `${prefix}evaluation.json`,
          JSON.stringify({
            evaluation: input.evaluation,
            script: input.evaluationScript,
          }, null, 2),
          "application/json",
        ),
      ];

      if (input.ttsAudio && input.ttsAudio.length > 0) {
        saves.push(
          this.client.saveFile(
            `${prefix}evaluation_audio.mp3`,
            input.ttsAudio,
            "audio/mpeg",
          ),
        );
      }

      await Promise.all(saves);
      log.info("Evaluation results saved to GCS", { prefix, fileCount: saves.length });

      return prefix;
    } catch (err) {
      log.error("Failed to save evaluation results to GCS", {
        error: err instanceof Error ? err : new Error(String(err)),
        prefix,
      });
      return null;
    }
  }

  /**
   * List evaluations for a speaker, sorted newest-first.
   * Uses prefix listing to find evaluation folders, then reads metadata.json
   * and generates signed read URLs for each file.
   *
   * @param speaker - Speaker name (will be sanitized)
   * @param limit - Maximum results to return (default 20)
   * @param cursor - Opaque cursor for pagination (base64-encoded index)
   */
  async listEvaluations(
    speaker: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<ListEvaluationsResult> {
    const sanitizedSpeaker = sanitizeForPath(speaker);
    const speakerPrefix = `${RESULTS_PREFIX}${sanitizedSpeaker}/`;

    log.info("Listing evaluations", { speaker: sanitizedSpeaker, limit, cursor });

    // Get all evaluation prefixes for this speaker
    const prefixes = await this.client.listPrefixes(speakerPrefix, "/");

    // Sort newest-first (prefixes are timestamped, so reverse alpha sort works)
    const sorted = prefixes.sort().reverse();

    // Apply pagination
    const startIndex = cursor ? parseInt(Buffer.from(cursor, "base64").toString("utf-8"), 10) : 0;
    const page = sorted.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sorted.length;

    // Read metadata and generate signed URLs for each evaluation
    const results: EvaluationListItem[] = [];
    for (const evalPrefix of page) {
      try {
        const metadataContent = await this.client.readFile(`${evalPrefix}metadata.json`);
        const metadata = JSON.parse(metadataContent) as EvaluationMetadata;

        // Generate signed read URLs for each file
        const urls = await this.signFilesForPrefix(evalPrefix);

        results.push({ metadata, urls });
      } catch (err) {
        log.warn("Failed to read evaluation metadata", {
          prefix: evalPrefix,
          error: err instanceof Error ? err.message : String(err),
        });
        // Skip this evaluation — corrupted or incomplete
      }
    }

    const nextCursor = hasMore
      ? Buffer.from(String(startIndex + limit)).toString("base64")
      : undefined;

    log.info("Listed evaluations", {
      speaker: sanitizedSpeaker,
      total: sorted.length,
      returned: results.length,
    });

    return { results, nextCursor };
  }

  /**
   * Generate signed read URLs for all files in an evaluation folder.
   */
  private async signFilesForPrefix(
    prefix: string,
  ): Promise<EvaluationListItem["urls"]> {
    const files = [
      { key: "transcript" as const, path: `${prefix}transcript.json` },
      { key: "metrics" as const, path: `${prefix}metrics.json` },
      { key: "evaluation" as const, path: `${prefix}evaluation.json` },
      { key: "audio" as const, path: `${prefix}evaluation_audio.mp3` },
      { key: "metadata" as const, path: `${prefix}metadata.json` },
    ];

    const urls: EvaluationListItem["urls"] = {};

    // Check existence and sign in parallel
    const checks = files.map(async ({ key, path }) => {
      try {
        const exists = await this.client.fileExists(path);
        if (exists) {
          urls[key] = await this.client.getSignedReadUrl(path, SIGNED_URL_EXPIRY_MINUTES);
        }
      } catch {
        // Skip files that can't be signed
      }
    });

    await Promise.all(checks);
    return urls;
  }

  /**
   * Delete a single evaluation by prefix (#128 — privacy hardening).
   * @param prefix - The full GCS prefix for the evaluation (e.g., "results/speaker/timestamp-title/")
   * @returns Number of files deleted
   */
  async deleteEvaluation(prefix: string): Promise<number> {
    if (!prefix.startsWith(RESULTS_PREFIX)) {
      throw new Error(`Invalid evaluation prefix: ${prefix}`);
    }
    const count = await this.client.deletePrefix(prefix);
    log.info("Deleted evaluation", { prefix, filesDeleted: count });
    return count;
  }

  /**
   * Delete all evaluations for a speaker (#128 — privacy hardening).
   * @param speakerName - The speaker name (sanitized internally)
   * @returns Number of files deleted
   */
  async deleteSpeakerHistory(speakerName: string): Promise<number> {
    const sanitized = sanitizeForPath(speakerName);
    const prefix = `${RESULTS_PREFIX}${sanitized}/`;
    const count = await this.client.deletePrefix(prefix);
    log.info("Deleted speaker history", { speaker: speakerName, prefix, filesDeleted: count });
    return count;
  }
}
