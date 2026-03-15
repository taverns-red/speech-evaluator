/**
 * EventBus — typed event emitter for pipeline decoupling.
 *
 * Provides a simple publish/subscribe mechanism so that components
 * (SessionManager, server, upload-handler) can communicate without
 * direct coupling. Events are typed via a generic event map.
 *
 * Issue: #83
 */

// ─── Event Map Type ──────────────────────────────────────────────────────────

/**
 * Type-safe event map. Extend this interface to define application events.
 *
 * Example:
 * ```ts
 * interface AppEvents {
 *   'session:created': { sessionId: string };
 *   'pipeline:progress': { sessionId: string; stage: string };
 * }
 * const bus = new EventBus<AppEvents>();
 * bus.on('session:created', ({ sessionId }) => { ... });
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler<T = any> = (payload: T) => void;

// ─── EventBus ────────────────────────────────────────────────────────────────

export class EventBus<TEvents extends Record<string, unknown>> {
  private handlers = new Map<keyof TEvents, Set<EventHandler>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   *
   * @param event - Event name
   * @param handler - Callback invoked when the event is emitted
   * @returns A function that removes this specific subscription
   */
  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      set!.delete(handler as EventHandler);
      if (set!.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event for a single emission only.
   * The handler is automatically removed after the first call.
   *
   * @param event - Event name
   * @param handler - Callback invoked once
   * @returns A function that removes this subscription (if not yet fired)
   */
  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  /**
   * Emit an event, invoking all registered handlers synchronously.
   * Handler errors are caught and logged to prevent one handler from
   * breaking other handlers or the emitter.
   *
   * @param event - Event name
   * @param payload - Event data
   */
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;

    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Handler error for event "${String(event)}":`, err);
      }
    }
  }

  /**
   * Remove all handlers for a specific event, or all events.
   *
   * @param event - Optional event name. If omitted, clears all handlers.
   */
  clear(event?: keyof TEvents): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Returns the number of handlers registered for a specific event.
   * Useful for testing and diagnostics.
   *
   * @param event - Event name
   * @returns Number of handlers
   */
  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
