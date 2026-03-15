/**
 * RoleRegistry — registration and lookup for meeting roles.
 *
 * Allows roles to be registered at startup and queried at runtime.
 * Integrates with EventBus to broadcast role lifecycle events.
 *
 * Issue: #72
 */

import type { MeetingRole, RoleContext, RoleInput, RoleResult } from "./meeting-role.js";
import type { EventBus } from "./event-bus.js";

// ─── Role Events ────────────────────────────────────────────────────────────────

export interface RoleEvents {
  "role:registered": { roleId: string; roleName: string };
  "role:started": { roleId: string; sessionId?: string };
  "role:completed": { roleId: string; sessionId?: string; durationMs: number };
  "role:failed": { roleId: string; sessionId?: string; error: string };
}

// ─── Registry ────────────────────────────────────────────────────────────────────

export class RoleRegistry {
  private roles = new Map<string, MeetingRole>();
  private eventBus: EventBus<RoleEvents> | null;

  constructor(eventBus?: EventBus<RoleEvents>) {
    this.eventBus = eventBus ?? null;
  }

  /**
   * Register a meeting role. Throws if a role with the same ID is already registered.
   *
   * @param role - The role to register
   * @returns this (for method chaining)
   * @throws Error if a role with the same ID exists
   */
  register(role: MeetingRole): this {
    if (this.roles.has(role.id)) {
      throw new Error(
        `Role already registered: "${role.id}". ` +
        `Use unregister() first to replace an existing role.`,
      );
    }
    this.roles.set(role.id, role);
    this.eventBus?.emit("role:registered", { roleId: role.id, roleName: role.name });
    return this;
  }

  /**
   * Retrieve a registered role by ID.
   *
   * @param id - Role identifier
   * @returns The role, or undefined if not registered
   */
  get(id: string): MeetingRole | undefined {
    return this.roles.get(id);
  }

  /**
   * List all registered roles.
   */
  list(): MeetingRole[] {
    return Array.from(this.roles.values());
  }

  /**
   * Returns roles whose `requiredInputs` are all satisfied by the given context.
   *
   * A role is runnable if every entry in its `requiredInputs` has a non-null,
   * non-empty value in the context.
   *
   * @param context - The current session data
   * @returns Roles that can run with the available data
   */
  getRunnable(context: RoleContext): MeetingRole[] {
    return this.list().filter((role) =>
      role.requiredInputs.every((input) => this.isInputAvailable(input, context)),
    );
  }

  /**
   * Run a specific role by ID against the given context.
   * Emits lifecycle events via EventBus.
   *
   * @param roleId - The role to run
   * @param context - Session data
   * @param sessionId - Optional session ID for event correlation
   * @returns The role result
   * @throws Error if the role is not registered or not runnable
   */
  async run(roleId: string, context: RoleContext, sessionId?: string): Promise<RoleResult> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not registered: "${roleId}"`);
    }

    // Validate required inputs are available
    const missingInputs = role.requiredInputs.filter(
      (input) => !this.isInputAvailable(input, context),
    );
    if (missingInputs.length > 0) {
      throw new Error(
        `Role "${roleId}" cannot run: missing required inputs [${missingInputs.join(", ")}]`,
      );
    }

    this.eventBus?.emit("role:started", { roleId, sessionId });
    const startTime = Date.now();

    try {
      const result = await role.run(context);
      const durationMs = Date.now() - startTime;
      this.eventBus?.emit("role:completed", { roleId, sessionId, durationMs });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.eventBus?.emit("role:failed", { roleId, sessionId, error: errorMessage });
      // Re-add duration to error for observability
      throw new Error(
        `Role "${roleId}" failed after ${durationMs}ms: ${errorMessage}`,
      );
    }
  }

  /**
   * Remove a role registration.
   *
   * @param id - Role identifier
   * @returns true if the role was removed
   */
  unregister(id: string): boolean {
    return this.roles.delete(id);
  }

  /**
   * Number of registered roles.
   */
  get size(): number {
    return this.roles.size;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private isInputAvailable(input: RoleInput, context: RoleContext): boolean {
    switch (input) {
      case "transcript":
        return context.transcript.length > 0;
      case "metrics":
        return context.metrics !== null;
      case "visualObservations":
        return context.visualObservations !== null;
      default:
        return false;
    }
  }
}
