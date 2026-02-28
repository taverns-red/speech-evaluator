// Auth Middleware — Firebase Auth JWT verification + email allowlist
// Issue #37: Protect the app so only authenticated, allowlisted users can access it.

import type { Request, Response, NextFunction } from "express";
import type { App as FirebaseApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

// Extend Express Request to carry authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: { email: string; uid: string; name?: string; picture?: string };
    }
  }
}

/** Routes that bypass authentication entirely */
const PUBLIC_PATHS = [
  "/health",
  "/login.html",
  "/login.js",
  "/style.css",
  "/favicon.ico",
];

/** Prefixes that bypass authentication (fonts, Firebase SDK, etc.) */
const PUBLIC_PREFIXES = [
  "/fonts/",
];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export interface AuthMiddlewareOptions {
  /** Firebase Admin app instance */
  firebaseApp: FirebaseApp;
  /** Set of allowed email addresses (lowercase) */
  allowedEmails: Set<string>;
}

/**
 * Creates Express middleware that:
 * 1. Exempts public paths (health, login page, static assets)
 * 2. Extracts Firebase ID token from __session cookie
 * 3. Verifies the token via Firebase Admin Auth
 * 4. Checks the email against the allowlist
 * 5. Attaches req.user on success, redirects to /login.html on failure
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const { firebaseApp, allowedEmails } = options;
  const auth = getAuth(firebaseApp);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip auth for public paths
    if (isPublicPath(req.path)) {
      next();
      return;
    }

    const token = req.cookies?.__session;

    if (!token) {
      // No session cookie — redirect to login
      res.redirect("/login.html");
      return;
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(token);
    } catch {
      // Invalid/expired token — redirect to login
      res.redirect("/login.html");
      return;
    }

    const email = decoded.email?.toLowerCase();

    if (!email || !allowedEmails.has(email)) {
      // Valid Firebase user but not on the allowlist
      res.status(403).send(accessDeniedHTML(email));
      return;
    }

    // Attach user info to request
    req.user = {
      email,
      uid: decoded.uid,
      ...(decoded.name ? { name: decoded.name as string } : {}),
      ...(decoded.picture ? { picture: decoded.picture as string } : {}),
    };
    next();
  };
}

/**
 * Verifies a Firebase ID token and checks the email against the allowlist.
 * Used for WebSocket upgrade authentication.
 * Returns the decoded token if valid and allowed, null otherwise.
 */
export async function verifyAndAuthorize(
  token: string,
  firebaseApp: FirebaseApp,
  allowedEmails: Set<string>,
): Promise<DecodedIdToken | null> {
  try {
    const auth = getAuth(firebaseApp);
    const decoded = await auth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email || !allowedEmails.has(email)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function accessDeniedHTML(email?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Denied - AI Speech Evaluator</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
  <style>
    .access-denied {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
    }
    .access-denied h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: var(--red-primary);
    }
    .access-denied p {
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .access-denied .email {
      font-family: monospace;
      color: var(--text-primary);
      background: var(--bg-card);
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
    }
    .access-denied .actions {
      margin-top: 2rem;
      display: flex;
      gap: 1rem;
    }
    .access-denied .btn-back {
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      border: none;
      background: var(--bg-card);
      color: var(--text-primary);
      font-family: 'Outfit', sans-serif;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    .access-denied .btn-back:hover {
      background: var(--bg-elevated);
    }
  </style>
</head>
<body>
  <div class="access-denied">
    <h1>🔒 Access Denied</h1>
    <p>Your account is not authorized to use this application.</p>
    ${email ? `<p>Signed in as <span class="email">${email}</span></p>` : ""}
    <p>Contact the administrator to request access.</p>
    <div class="actions">
      <a href="/login.html" class="btn-back" onclick="document.cookie='__session=;path=/;max-age=0'">Sign in with a different account</a>
    </div>
  </div>
</body>
</html>`;
}
