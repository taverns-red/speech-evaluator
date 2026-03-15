/**
 * ServiceRegistry Tests — verifies typed DI container behavior.
 * Issue: #86
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ServiceRegistry, ServiceTokens } from "./service-registry.js";

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("ServiceRegistry", () => {
  it("registers and retrieves a service", () => {
    const registry = new ServiceRegistry();
    const service = { name: "test" };
    registry.register("test", service);

    expect(registry.get("test")).toBe(service);
  });

  it("throws on get() for unregistered service", () => {
    const registry = new ServiceRegistry();

    expect(() => registry.get("missing")).toThrowError(
      /Service not registered: "missing"/,
    );
  });

  it("error message lists available services", () => {
    const registry = new ServiceRegistry();
    registry.register("foo", 1);
    registry.register("bar", 2);

    expect(() => registry.get("baz")).toThrowError(
      /Available services: \[foo, bar\]/,
    );
  });

  it("tryGet() returns undefined for unregistered service", () => {
    const registry = new ServiceRegistry();

    expect(registry.tryGet("missing")).toBeUndefined();
  });

  it("tryGet() returns the service when registered", () => {
    const registry = new ServiceRegistry();
    const service = { name: "service" };
    registry.register("key", service);

    expect(registry.tryGet("key")).toBe(service);
  });

  it("has() returns false for unregistered, true for registered", () => {
    const registry = new ServiceRegistry();

    expect(registry.has("test")).toBe(false);
    registry.register("test", {});
    expect(registry.has("test")).toBe(true);
  });

  it("unregister() removes a service", () => {
    const registry = new ServiceRegistry();
    registry.register("test", {});

    expect(registry.unregister("test")).toBe(true);
    expect(registry.has("test")).toBe(false);
    expect(registry.unregister("test")).toBe(false);
  });

  it("clear() removes all services", () => {
    const registry = new ServiceRegistry();
    registry.register("a", 1);
    registry.register("b", 2);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.has("a")).toBe(false);
    expect(registry.has("b")).toBe(false);
  });

  it("size returns the number of registered services", () => {
    const registry = new ServiceRegistry();
    expect(registry.size).toBe(0);

    registry.register("a", 1);
    expect(registry.size).toBe(1);

    registry.register("b", 2);
    expect(registry.size).toBe(2);
  });

  it("tokens returns all registered tokens", () => {
    const registry = new ServiceRegistry();
    registry.register("alpha", 1);
    registry.register("beta", 2);

    expect(registry.tokens).toEqual(["alpha", "beta"]);
  });

  it("register() supports method chaining", () => {
    const registry = new ServiceRegistry();
    const result = registry
      .register("a", 1)
      .register("b", 2)
      .register("c", 3);

    expect(result).toBe(registry);
    expect(registry.size).toBe(3);
  });

  it("register() overwrites existing registration", () => {
    const registry = new ServiceRegistry();
    registry.register("key", "old");
    registry.register("key", "new");

    expect(registry.get("key")).toBe("new");
    expect(registry.size).toBe(1);
  });

  it("works with ServiceTokens constants", () => {
    const registry = new ServiceRegistry();
    const mockEngine = { transcribe: () => {} };
    registry.register(ServiceTokens.TRANSCRIPTION_ENGINE, mockEngine);

    expect(registry.get(ServiceTokens.TRANSCRIPTION_ENGINE)).toBe(mockEngine);
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("ServiceRegistry property tests", () => {
  it("every registered service is retrievable", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.integer(),
          ),
          { minLength: 1, maxLength: 50 },
        ),
        (entries) => {
          const registry = new ServiceRegistry();
          const uniqueEntries = new Map(entries);

          for (const [key, value] of uniqueEntries) {
            registry.register(key, value);
          }

          for (const [key, value] of uniqueEntries) {
            expect(registry.get(key)).toBe(value);
          }

          expect(registry.size).toBe(uniqueEntries.size);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("unregistering makes service unretrievable", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer(),
        (key, value) => {
          const registry = new ServiceRegistry();
          registry.register(key, value);
          registry.unregister(key);

          expect(registry.has(key)).toBe(false);
          expect(registry.tryGet(key)).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
