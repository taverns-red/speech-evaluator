/**
 * Share Token Module (#164)
 *
 * Generates cryptographically secure URL-safe tokens for publicly shareable
 * evaluation links. Tokens are stored in GCS alongside the evaluation data.
 */

import { randomBytes } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ShareRecord {
  /** URL-safe share token */
  token: string;
  /** Speaker name (for display) */
  speaker: string;
  /** GCS prefix for the evaluation (e.g., "results/alice/2026-03-21-1700-title/") */
  evalPrefix: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

// ─── Token Generation ───────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure URL-safe token.
 *
 * The token is 16 random bytes encoded as base64url (22 chars).
 * This provides 128 bits of entropy — more than sufficient for
 * unguessable share links.
 *
 * @returns A 22-character URL-safe string
 */
export function generateShareToken(): string {
  return randomBytes(16)
    .toString("base64url")
    .replace(/=+$/, ""); // Strip padding (base64url shouldn't have it, but be safe)
}

/**
 * Create a ShareRecord with a fresh token.
 */
export function createShareRecord(
  speaker: string,
  evalPrefix: string,
): ShareRecord {
  return {
    token: generateShareToken(),
    speaker,
    evalPrefix,
    createdAt: new Date().toISOString(),
  };
}

// ─── GCS Path Helpers ───────────────────────────────────────────────────────────

/**
 * Build the GCS path for a share record.
 * Stored alongside the evaluation: <evalPrefix>share.json
 */
export function buildSharePath(evalPrefix: string): string {
  return `${evalPrefix}share.json`;
}

/**
 * Build the GCS path for a share index entry.
 * Index is stored at: shares/<token>.json → pointer to evalPrefix.
 * This enables O(1) token → evaluation lookup.
 */
export function buildShareIndexPath(token: string): string {
  return `shares/${token}.json`;
}
