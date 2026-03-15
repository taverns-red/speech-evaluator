/**
 * ServiceRegistry — typed dependency injection container.
 *
 * Replaces manual dependency passing with a centralized registry.
 * Services are registered by token (string key) and retrieved with
 * type safety via a generic get() method.
 *
 * This is a singleton container — register services once at startup
 * (in index.ts), then inject into consumers via get().
 *
 * Issue: #86
 */

// ─── Service Token Type ─────────────────────────────────────────────────────────

/**
 * Well-known service tokens for the speech evaluator application.
 * These string constants provide type-safe keys for registration/lookup.
 */
export const ServiceTokens = {
  TRANSCRIPTION_ENGINE: "transcriptionEngine",
  METRICS_EXTRACTOR: "metricsExtractor",
  EVALUATION_GENERATOR: "evaluationGenerator",
  TTS_ENGINE: "ttsEngine",
  TONE_CHECKER: "toneChecker",
  FILE_PERSISTENCE: "filePersistence",
  EVENT_BUS: "eventBus",
} as const;

export type ServiceToken = (typeof ServiceTokens)[keyof typeof ServiceTokens];

// ─── Registry ────────────────────────────────────────────────────────────────────

export class ServiceRegistry {
  private services = new Map<string, unknown>();

  /**
   * Register a service instance under a token.
   *
   * @param token - Service identifier
   * @param instance - The service instance
   * @returns this (for method chaining)
   */
  register<T>(token: string, instance: T): this {
    this.services.set(token, instance);
    return this;
  }

  /**
   * Retrieve a registered service by token.
   *
   * @param token - Service identifier
   * @returns The service instance
   * @throws Error if the service is not registered
   */
  get<T>(token: string): T {
    const service = this.services.get(token);
    if (service === undefined) {
      throw new Error(
        `Service not registered: "${token}". ` +
        `Available services: [${Array.from(this.services.keys()).join(", ")}]`,
      );
    }
    return service as T;
  }

  /**
   * Try to retrieve a service, returning undefined if not registered.
   *
   * @param token - Service identifier
   * @returns The service instance, or undefined
   */
  tryGet<T>(token: string): T | undefined {
    return this.services.get(token) as T | undefined;
  }

  /**
   * Check if a service is registered.
   *
   * @param token - Service identifier
   * @returns true if registered
   */
  has(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Remove a service registration.
   *
   * @param token - Service identifier
   * @returns true if the service was removed
   */
  unregister(token: string): boolean {
    return this.services.delete(token);
  }

  /**
   * Clear all registrations. Useful for testing.
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Returns the number of registered services.
   */
  get size(): number {
    return this.services.size;
  }

  /**
   * Returns all registered service tokens.
   */
  get tokens(): string[] {
    return Array.from(this.services.keys());
  }
}
