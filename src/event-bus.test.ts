/**
 * EventBus Tests — verifies typed event emitter behavior.
 * Issue: #83
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { EventBus } from "./event-bus.js";

// ─── Test Event Map ──────────────────────────────────────────────────────────

interface TestEvents {
  "test:simple": { value: number };
  "test:string": { message: string };
  "test:void": Record<string, never>;
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("EventBus", () => {
  it("calls handler when event is emitted", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on("test:simple", handler);

    bus.emit("test:simple", { value: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it("supports multiple handlers for the same event", () => {
    const bus = new EventBus<TestEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on("test:simple", handler1);
    bus.on("test:simple", handler2);

    bus.emit("test:simple", { value: 1 });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("does not call handler for different events", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on("test:simple", handler);

    bus.emit("test:string", { message: "hello" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe function removes the handler", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on("test:simple", handler);

    bus.emit("test:simple", { value: 1 });
    expect(handler).toHaveBeenCalledOnce();

    unsubscribe();
    bus.emit("test:simple", { value: 2 });
    expect(handler).toHaveBeenCalledOnce(); // not called again
  });

  it("once() fires handler exactly once then auto-removes", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.once("test:simple", handler);

    bus.emit("test:simple", { value: 1 });
    bus.emit("test:simple", { value: 2 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 1 });
  });

  it("once() unsubscribe works before emission", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.once("test:simple", handler);

    unsubscribe();
    bus.emit("test:simple", { value: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("handler errors are caught and do not prevent other handlers", () => {
    const bus = new EventBus<TestEvents>();
    const errorHandler = vi.fn(() => { throw new Error("boom"); });
    const goodHandler = vi.fn();

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    bus.on("test:simple", errorHandler);
    bus.on("test:simple", goodHandler);

    bus.emit("test:simple", { value: 1 });

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("clear(event) removes all handlers for that event", () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on("test:simple", handler);
    bus.on("test:simple", vi.fn());

    bus.clear("test:simple");
    bus.emit("test:simple", { value: 1 });

    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount("test:simple")).toBe(0);
  });

  it("clear() removes all handlers for all events", () => {
    const bus = new EventBus<TestEvents>();
    bus.on("test:simple", vi.fn());
    bus.on("test:string", vi.fn());

    bus.clear();

    expect(bus.listenerCount("test:simple")).toBe(0);
    expect(bus.listenerCount("test:string")).toBe(0);
  });

  it("listenerCount returns correct count", () => {
    const bus = new EventBus<TestEvents>();
    expect(bus.listenerCount("test:simple")).toBe(0);

    bus.on("test:simple", vi.fn());
    expect(bus.listenerCount("test:simple")).toBe(1);

    bus.on("test:simple", vi.fn());
    expect(bus.listenerCount("test:simple")).toBe(2);
  });

  it("emitting event with no handlers does not throw", () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit("test:simple", { value: 1 })).not.toThrow();
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("EventBus property tests", () => {
  it("every on() subscription receives every emit()", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 50 }),
        (values) => {
          const bus = new EventBus<TestEvents>();
          const received: number[] = [];
          bus.on("test:simple", ({ value }) => received.push(value));

          for (const v of values) {
            bus.emit("test:simple", { value: v });
          }

          expect(received).toEqual(values);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("unsubscribe prevents further handler calls", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        (totalEmits, unsubAt) => {
          fc.pre(unsubAt < totalEmits);

          const bus = new EventBus<TestEvents>();
          let callCount = 0;
          const unsub = bus.on("test:simple", () => { callCount++; });

          for (let i = 0; i < totalEmits; i++) {
            if (i === unsubAt) unsub();
            bus.emit("test:simple", { value: i });
          }

          expect(callCount).toBe(unsubAt);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("once() fires at most once regardless of emission count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (emitCount) => {
          const bus = new EventBus<TestEvents>();
          let callCount = 0;
          bus.once("test:simple", () => { callCount++; });

          for (let i = 0; i < emitCount; i++) {
            bus.emit("test:simple", { value: i });
          }

          expect(callCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
