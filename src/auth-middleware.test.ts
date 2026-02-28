// Auth Middleware Tests — Issue #37
// Verifies JWT verification, email allowlist, public path exemptions,
// and WebSocket upgrade auth.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createAuthMiddleware, verifyAndAuthorize } from "./auth-middleware.js";
import type { App as FirebaseApp } from "firebase-admin/app";

// ─── Mock firebase-admin/auth ───────────────────────────────────────────────────

const mockVerifyIdToken = vi.fn();

vi.mock("firebase-admin/auth", () => ({
    getAuth: () => ({
        verifyIdToken: mockVerifyIdToken,
    }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockRequest(overrides: Partial<Request> = {}): Request {
    return {
        path: "/",
        cookies: {},
        ...overrides,
    } as unknown as Request;
}

function mockResponse(): Response & { statusCode?: number; body?: string; redirectUrl?: string } {
    const res = {
        statusCode: undefined as number | undefined,
        body: undefined as string | undefined,
        redirectUrl: undefined as string | undefined,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(body: string) {
            res.body = body;
            return res;
        },
        redirect(url: string) {
            res.redirectUrl = url;
            return res;
        },
        json(data: unknown) {
            res.body = JSON.stringify(data);
            return res;
        },
    };
    return res as unknown as Response & { statusCode?: number; body?: string; redirectUrl?: string };
}

const fakeApp = {} as FirebaseApp;
const allowedEmails = new Set(["alice@example.com", "bob@example.com"]);

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("Auth Middleware", () => {
    let middleware: ReturnType<typeof createAuthMiddleware>;

    beforeEach(() => {
        vi.clearAllMocks();
        middleware = createAuthMiddleware({ firebaseApp: fakeApp, allowedEmails });
    });

    // ── Public Paths ──────────────────────────────────────────────────────────────

    describe("public paths bypass auth", () => {
        const publicPaths = ["/health", "/login.html", "/login.js", "/style.css", "/favicon.ico"];

        for (const path of publicPaths) {
            it(`allows ${path} without auth`, async () => {
                const req = mockRequest({ path });
                const res = mockResponse();
                const next = vi.fn();

                await middleware(req, res, next);

                expect(next).toHaveBeenCalled();
                expect(res.redirectUrl).toBeUndefined();
                expect(res.statusCode).toBeUndefined();
            });
        }

        it("allows font paths without auth", async () => {
            const req = mockRequest({ path: "/fonts/Outfit-Regular.woff2" });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    // ── No Token ──────────────────────────────────────────────────────────────────

    describe("missing token", () => {
        it("redirects to /login.html when no __session cookie", async () => {
            const req = mockRequest({ path: "/", cookies: {} });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.redirectUrl).toBe("/login.html");
        });
    });

    // ── Invalid Token ─────────────────────────────────────────────────────────────

    describe("invalid token", () => {
        it("redirects to /login.html when token verification fails", async () => {
            mockVerifyIdToken.mockRejectedValueOnce(new Error("Token expired"));
            const req = mockRequest({ path: "/", cookies: { __session: "expired-token" } });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.redirectUrl).toBe("/login.html");
        });
    });

    // ── Valid Token, Not Allowlisted ──────────────────────────────────────────────

    describe("valid token but email not in allowlist", () => {
        it("returns 403 with access denied page", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                uid: "user-123",
                email: "stranger@example.com",
            });
            const req = mockRequest({ path: "/", cookies: { __session: "valid-token" } });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
            expect(res.body).toContain("Access Denied");
            expect(res.body).toContain("stranger@example.com");
        });

        it("returns 403 when token has no email", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                uid: "user-123",
                // no email field
            });
            const req = mockRequest({ path: "/", cookies: { __session: "valid-token" } });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
        });
    });

    // ── Valid Token, Allowlisted ──────────────────────────────────────────────────

    describe("valid token and email in allowlist", () => {
        it("calls next() and attaches req.user", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                uid: "user-alice",
                email: "alice@example.com",
            });
            const req = mockRequest({ path: "/", cookies: { __session: "valid-token" } });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toEqual({ email: "alice@example.com", uid: "user-alice" });
        });

        it("handles case-insensitive email matching", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                uid: "user-alice",
                email: "Alice@Example.COM",
            });
            const req = mockRequest({ path: "/", cookies: { __session: "valid-token" } });
            const res = mockResponse();
            const next = vi.fn();

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toEqual({ email: "alice@example.com", uid: "user-alice" });
        });
    });

    // ── Protected Routes ──────────────────────────────────────────────────────────

    describe("protected routes require auth", () => {
        const protectedPaths = ["/", "/index.html", "/api/version", "/api/upload"];

        for (const path of protectedPaths) {
            it(`requires auth for ${path}`, async () => {
                const req = mockRequest({ path, cookies: {} });
                const res = mockResponse();
                const next = vi.fn();

                await middleware(req, res, next);

                expect(next).not.toHaveBeenCalled();
                expect(res.redirectUrl).toBe("/login.html");
            });
        }
    });
});

// ─── WebSocket Auth (verifyAndAuthorize) ────────────────────────────────────────

describe("verifyAndAuthorize", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns decoded token for valid, allowlisted user", async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            uid: "ws-user",
            email: "alice@example.com",
        });

        const result = await verifyAndAuthorize("valid-token", fakeApp, allowedEmails);
        expect(result).not.toBeNull();
        expect(result!.uid).toBe("ws-user");
    });

    it("returns null for valid token but non-allowlisted email", async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            uid: "ws-user",
            email: "hacker@evil.com",
        });

        const result = await verifyAndAuthorize("valid-token", fakeApp, allowedEmails);
        expect(result).toBeNull();
    });

    it("returns null for invalid token", async () => {
        mockVerifyIdToken.mockRejectedValueOnce(new Error("Invalid token"));

        const result = await verifyAndAuthorize("bad-token", fakeApp, allowedEmails);
        expect(result).toBeNull();
    });

    it("returns null when token has no email", async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            uid: "ws-user",
        });

        const result = await verifyAndAuthorize("valid-token", fakeApp, allowedEmails);
        expect(result).toBeNull();
    });
});
