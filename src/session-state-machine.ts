/**
 * Session State Machine — pure validation logic for session state transitions.
 *
 * Extracted from SessionManager to decouple state machine rules from
 * pipeline orchestration. This module is stateless and side-effect-free.
 *
 * Issue: #81
 */

import { SessionState } from "./types.js";

// ─── Valid Transitions ───────────────────────────────────────────────────────

/**
 * Valid state transitions for the session state machine.
 *
 * IDLE → RECORDING:      startRecording()
 * RECORDING → PROCESSING:  stopRecording()
 * PROCESSING → DELIVERING: generateEvaluation() → TTS starts
 * DELIVERING → IDLE:       completeDelivery() (TTS complete)
 *
 * panicMute() can transition from ANY state → IDLE (bypasses this map)
 */
export const VALID_TRANSITIONS: ReadonlyMap<SessionState, SessionState> = new Map([
  [SessionState.IDLE, SessionState.RECORDING],
  [SessionState.RECORDING, SessionState.PROCESSING],
  [SessionState.PROCESSING, SessionState.DELIVERING],
  [SessionState.DELIVERING, SessionState.IDLE],
]);

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that a state transition is allowed and throws if not.
 *
 * @param current - The current session state
 * @param target - The desired target state
 * @param context - Optional context string for error messages (e.g., "startRecording")
 * @throws Error if the transition is not valid
 */
export function assertValidTransition(
  current: SessionState,
  target: SessionState,
  context?: string,
): void {
  const expected = VALID_TRANSITIONS.get(current);
  if (expected !== target) {
    // Find the source state that would make this target valid
    let expectedSource = "unknown";
    for (const [source, t] of VALID_TRANSITIONS) {
      if (t === target) {
        expectedSource = source;
        break;
      }
    }

    const contextStr = context ? `${context}()` : "this operation";
    throw new Error(
      `Invalid state transition: cannot call ${contextStr} in "${current}" state. ` +
      `Expected state: "${expectedSource}". ` +
      `Current state: "${current}".`,
    );
  }
}

/**
 * Checks if a state transition is valid without throwing.
 *
 * @param current - The current session state
 * @param target - The desired target state
 * @returns true if the transition is allowed
 */
export function isValidTransition(
  current: SessionState,
  target: SessionState,
): boolean {
  return VALID_TRANSITIONS.get(current) === target;
}

/**
 * Returns the expected next state for a given current state, or null if
 * the current state has no valid outgoing transition in the normal flow.
 *
 * @param current - The current session state
 * @returns The expected next state, or null
 */
export function getNextState(current: SessionState): SessionState | null {
  return VALID_TRANSITIONS.get(current) ?? null;
}
