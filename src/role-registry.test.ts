/**
 * RoleRegistry Tests — verifies role registration, lookup, and execution.
 * Issue: #72
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { RoleRegistry } from "./role-registry.js";
import { EventBus } from "./event-bus.js";
import type { RoleEvents } from "./role-registry.js";
import type { MeetingRole, RoleContext, RoleResult } from "./meeting-role.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────────

function makeRole(
  overrides: Partial<MeetingRole> & { id: string } = { id: "test" },
): MeetingRole {
  return {
    name: overrides.name ?? `Role ${overrides.id}`,
    description: overrides.description ?? `Test role ${overrides.id}`,
    requiredInputs: overrides.requiredInputs ?? ["transcript"],
    run: overrides.run ?? (async (ctx) => ({
      roleId: overrides.id,
      report: { title: "Test", sections: [{ heading: "H", content: "C" }] },
      script: "Test script.",
    })),
    ...overrides,
  };
}

function makeContext(overrides: Partial<RoleContext> = {}): RoleContext {
  return {
    transcript: overrides.transcript ?? [
      { text: "Hello", startTime: 0, endTime: 1, words: [], isFinal: true },
    ],
    metrics: overrides.metrics ?? null,
    visualObservations: overrides.visualObservations ?? null,
    projectContext: overrides.projectContext ?? null,
    consent: overrides.consent ?? null,
    speakerName: overrides.speakerName ?? null,
    config: overrides.config ?? {},
  };
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("RoleRegistry", () => {
  let registry: RoleRegistry;

  beforeEach(() => {
    registry = new RoleRegistry();
  });

  it("registers and retrieves a role", () => {
    const role = makeRole({ id: "test-role" });
    registry.register(role);

    expect(registry.get("test-role")).toBe(role);
    expect(registry.size).toBe(1);
  });

  it("throws on duplicate registration", () => {
    registry.register(makeRole({ id: "dup" }));

    expect(() => registry.register(makeRole({ id: "dup" }))).toThrowError(
      /Role already registered: "dup"/,
    );
  });

  it("supports method chaining", () => {
    const result = registry
      .register(makeRole({ id: "a" }))
      .register(makeRole({ id: "b" }));

    expect(result).toBe(registry);
    expect(registry.size).toBe(2);
  });

  it("lists all registered roles", () => {
    registry.register(makeRole({ id: "alpha" }));
    registry.register(makeRole({ id: "beta" }));

    const roles = registry.list();
    expect(roles).toHaveLength(2);
    expect(roles.map((r) => r.id)).toEqual(["alpha", "beta"]);
  });

  it("returns undefined for unregistered role", () => {
    expect(registry.get("missing")).toBeUndefined();
  });

  it("unregisters a role", () => {
    registry.register(makeRole({ id: "x" }));

    expect(registry.unregister("x")).toBe(true);
    expect(registry.get("x")).toBeUndefined();
    expect(registry.size).toBe(0);
  });
});

describe("RoleRegistry.getRunnable", () => {
  let registry: RoleRegistry;

  beforeEach(() => {
    registry = new RoleRegistry();
  });

  it("returns roles whose required inputs are available", () => {
    registry.register(makeRole({ id: "needs-transcript", requiredInputs: ["transcript"] }));
    registry.register(makeRole({ id: "needs-metrics", requiredInputs: ["metrics"] }));

    const context = makeContext({ transcript: [{ text: "Hi", startTime: 0, endTime: 1, words: [], isFinal: true }] });
    const runnable = registry.getRunnable(context);

    expect(runnable.map((r) => r.id)).toEqual(["needs-transcript"]);
  });

  it("returns empty array when no roles are runnable", () => {
    registry.register(makeRole({ id: "needs-video", requiredInputs: ["visualObservations"] }));

    const context = makeContext();
    const runnable = registry.getRunnable(context);

    expect(runnable).toEqual([]);
  });

  it("handles roles with no required inputs", () => {
    registry.register(makeRole({ id: "no-deps", requiredInputs: [] }));

    const context = makeContext({ transcript: [] });
    const runnable = registry.getRunnable(context);

    expect(runnable.map((r) => r.id)).toEqual(["no-deps"]);
  });

  it("checks all required inputs", () => {
    registry.register(makeRole({
      id: "needs-both",
      requiredInputs: ["transcript", "metrics"],
    }));

    // Only transcript available
    const partial = makeContext();
    expect(registry.getRunnable(partial)).toEqual([]);

    // Both available
    const full = makeContext({
      metrics: {
        durationSeconds: 60, durationFormatted: "1:00", totalWords: 100,
        wordsPerMinute: 100, fillerWords: [], fillerWordCount: 0,
        fillerWordFrequency: 0, pauseCount: 0, totalPauseDurationSeconds: 0,
        averagePauseDurationSeconds: 0, intentionalPauseCount: 0,
        hesitationPauseCount: 0, classifiedPauses: [],
        energyVariationCoefficient: 0, energyProfile: {
          windowDurationMs: 500, windows: [], coefficientOfVariation: 0,
          silenceThreshold: 0,
        },
        classifiedFillers: [], visualMetrics: null,
      },
    });
    expect(registry.getRunnable(full).map((r) => r.id)).toEqual(["needs-both"]);
  });
});

describe("RoleRegistry.run", () => {
  let registry: RoleRegistry;
  let eventBus: EventBus<RoleEvents>;

  beforeEach(() => {
    eventBus = new EventBus<RoleEvents>();
    registry = new RoleRegistry(eventBus);
  });

  it("runs a role and returns the result", async () => {
    const runFn = vi.fn(async () => ({
      roleId: "test",
      report: { title: "T", sections: [] },
      script: "Hello.",
    }));
    registry.register(makeRole({ id: "test", run: runFn }));

    const result = await registry.run("test", makeContext());

    expect(runFn).toHaveBeenCalledOnce();
    expect(result.roleId).toBe("test");
    expect(result.script).toBe("Hello.");
  });

  it("throws for unregistered role", async () => {
    await expect(
      registry.run("missing", makeContext()),
    ).rejects.toThrowError(/Role not registered: "missing"/);
  });

  it("throws for missing required inputs", async () => {
    registry.register(makeRole({ id: "needs-metrics", requiredInputs: ["metrics"] }));

    await expect(
      registry.run("needs-metrics", makeContext()),
    ).rejects.toThrowError(/missing required inputs \[metrics\]/);
  });

  it("emits lifecycle events", async () => {
    const started = vi.fn();
    const completed = vi.fn();
    eventBus.on("role:started", started);
    eventBus.on("role:completed", completed);

    registry.register(makeRole({ id: "evt-role" }));
    await registry.run("evt-role", makeContext(), "session-123");

    expect(started).toHaveBeenCalledWith({ roleId: "evt-role", sessionId: "session-123" });
    expect(completed).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: "evt-role", sessionId: "session-123" }),
    );
  });

  it("emits role:failed on error", async () => {
    const failedHandler = vi.fn();
    eventBus.on("role:failed", failedHandler);

    registry.register(makeRole({
      id: "fail-role",
      run: async () => { throw new Error("boom"); },
    }));

    await expect(
      registry.run("fail-role", makeContext()),
    ).rejects.toThrowError(/Role "fail-role" failed/);

    expect(failedHandler).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: "fail-role", error: "boom" }),
    );
  });

  it("emits role:registered on register", () => {
    const handler = vi.fn();
    eventBus.on("role:registered", handler);

    registry.register(makeRole({ id: "new-role", name: "New Role" }));

    expect(handler).toHaveBeenCalledWith({ roleId: "new-role", roleName: "New Role" });
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("RoleRegistry property tests", () => {
  it("getRunnable never returns roles with unsatisfied inputs", () => {
    fc.assert(
      fc.property(
        fc.boolean(), // has transcript
        fc.boolean(), // has metrics
        fc.boolean(), // has visual
        (hasTranscript, hasMetrics, hasVisual) => {
          const registry = new RoleRegistry();

          // Register roles for all input combinations
          registry.register(makeRole({ id: "t", requiredInputs: ["transcript"] }));
          registry.register(makeRole({ id: "m", requiredInputs: ["metrics"] }));
          registry.register(makeRole({ id: "v", requiredInputs: ["visualObservations"] }));
          registry.register(makeRole({ id: "tm", requiredInputs: ["transcript", "metrics"] }));
          registry.register(makeRole({ id: "none", requiredInputs: [] }));

          const context = makeContext({
            transcript: hasTranscript
              ? [{ text: "X", startTime: 0, endTime: 1, words: [], isFinal: true }]
              : [],
            metrics: hasMetrics
              ? {
                  durationSeconds: 1, durationFormatted: "0:01", totalWords: 1,
                  wordsPerMinute: 60, fillerWords: [], fillerWordCount: 0,
                  fillerWordFrequency: 0, pauseCount: 0, totalPauseDurationSeconds: 0,
                  averagePauseDurationSeconds: 0, intentionalPauseCount: 0,
                  hesitationPauseCount: 0, classifiedPauses: [],
                  energyVariationCoefficient: 0, energyProfile: {
                    windowDurationMs: 500, windows: [], coefficientOfVariation: 0,
                    silenceThreshold: 0,
                  },
                  classifiedFillers: [], visualMetrics: null,
                }
              : null,
            visualObservations: hasVisual
              ? ({} as any)
              : null,
          });

          const runnable = registry.getRunnable(context);

          // Verify: every returned role has all inputs satisfied
          for (const role of runnable) {
            for (const input of role.requiredInputs) {
              switch (input) {
                case "transcript":
                  expect(context.transcript.length).toBeGreaterThan(0);
                  break;
                case "metrics":
                  expect(context.metrics).not.toBeNull();
                  break;
                case "visualObservations":
                  expect(context.visualObservations).not.toBeNull();
                  break;
              }
            }
          }

          // "none" role always runnable
          expect(runnable.some((r) => r.id === "none")).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });
});
