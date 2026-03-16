/**
 * Request Timeout Middleware Tests — Phase 7 Sprint 2 (#118)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import http from "node:http";
import express from "express";
import { requestTimeout } from "./request-timeout.js";

function fetch(server: http.Server, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === "string") return reject(new Error("No address"));
    const req = http.get(`http://127.0.0.1:${addr.port}${path}`, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
  });
}

describe("requestTimeout middleware", () => {
  let server: http.Server;

  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server?.listening) server.close(() => resolve());
      else resolve();
    });
  });

  function listen(app: express.Express): Promise<void> {
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, () => resolve()));
  }

  it("passes through when handler responds before timeout", async () => {
    const app = express();
    app.get("/fast", requestTimeout(1000), (_req, res) => {
      res.json({ ok: true });
    });
    await listen(app);

    const response = await fetch(server, "/fast");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it("returns 504 when handler exceeds timeout", async () => {
    const app = express();
    app.get("/slow", requestTimeout(50), (_req, res) => {
      // Intentionally delay — timeout should fire first
      setTimeout(() => {
        if (!res.headersSent) res.json({ ok: true });
      }, 500);
    });
    await listen(app);

    const response = await fetch(server, "/slow");
    expect(response.status).toBe(504);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("timeout");
  });

  it("uses default timeout when no argument provided", () => {
    const mw = requestTimeout();
    expect(typeof mw).toBe("function");
  });

  it("does not interfere with response after handler completes", async () => {
    const app = express();
    app.get("/normal", requestTimeout(1000), (_req, res) => {
      res.json({ data: "hello" });
    });
    await listen(app);

    const response = await fetch(server, "/normal");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).data).toBe("hello");
  });

  it("cleans up timer on response finish to prevent leaks", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const app = express();
    app.get("/cleanup", requestTimeout(5000), (_req, res) => {
      res.json({ ok: true });
    });
    await listen(app);

    await fetch(server, "/cleanup");
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
