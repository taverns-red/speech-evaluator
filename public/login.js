// Login.js — Firebase Auth client-side logic
// Issue #37: Handles sign-in with Google, Apple, and GitHub providers.
// Sets __session cookie with Firebase ID token for server-side verification.

/* global firebase */

// DOM elements
const errorEl = document.getElementById("login-error");
const loadingEl = document.getElementById("login-loading");
const btnGoogle = document.getElementById("btn-google");
const btnApple = document.getElementById("btn-apple");
const btnGitHub = document.getElementById("btn-github");

/**
 * Detect iOS or Safari browsers where signInWithPopup fails due to
 * ITP (Intelligent Tracking Prevention) partitioning sessionStorage.
 * All iOS browsers use Safari's WebKit engine, so this covers Chrome/Firefox on iOS too.
 */
function isIOSOrSafari() {
    const ua = navigator.userAgent;
    // iOS devices (iPhone, iPad, iPod)
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPad with desktop user agent (iPadOS 13+)
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    // Desktop Safari (not Chrome/Firefox/Edge which include 'Chrome' in UA)
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return true;
    return false;
}

function setSessionCookie(token) {
    // __session is the only cookie name Cloud Run preserves
    document.cookie = `__session=${token};path=/;max-age=3600;SameSite=Lax;Secure`;
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add("visible");
    loadingEl.classList.remove("visible");
    enableButtons();
}

function showLoading() {
    errorEl.classList.remove("visible");
    loadingEl.classList.add("visible");
    disableButtons();
}

function disableButtons() {
    btnGoogle.disabled = true;
    btnApple.disabled = true;
    btnGitHub.disabled = true;
}

function enableButtons() {
    btnGoogle.disabled = false;
    btnApple.disabled = false;
    btnGitHub.disabled = false;
}

async function handleSignIn(provider) {
    showLoading();
    try {
        if (isIOSOrSafari()) {
            // iOS/Safari: use redirect flow to avoid ITP sessionStorage issues (#111)
            await auth.signInWithRedirect(provider);
            // Page will redirect to OAuth provider — execution stops here
        } else {
            // Desktop: use popup flow (better UX — stays on same page)
            const result = await auth.signInWithPopup(provider);
            const token = await result.user.getIdToken();
            setSessionCookie(token);
            window.location.href = "/";
        }
    } catch (err) {
        if (err.code === "auth/popup-closed-by-user") {
            enableButtons();
            loadingEl.classList.remove("visible");
            return;
        }
        if (err.code === "auth/popup-blocked") {
            // Popup was blocked — fall back to redirect flow
            try {
                await auth.signInWithRedirect(provider);
            } catch (redirectErr) {
                showError(redirectErr.message || "Sign-in failed. Please try again.");
            }
            return;
        }
        if (err.code === "auth/account-exists-with-different-credential") {
            showError("An account already exists with this email using a different sign-in method. Try another provider.");
            return;
        }
        console.error("Sign-in error:", err);
        showError(err.message || "Sign-in failed. Please try again.");
    }
}

// ─── Fetch Firebase config from server and initialize ─────────────────────────
let auth;

(async function init() {
    try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error(`Config endpoint returned ${res.status}`);
        const firebaseConfig = await res.json();

        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();

        // Handle sign-out action from main app
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("action") === "signout") {
            auth.signOut().then(() => {
                document.cookie = "__session=;path=/;max-age=0";
                window.location.replace("/login.html");
            });
        } else {
            // Handle redirect result (iOS Safari returns here after OAuth redirect, #111)
            auth.getRedirectResult().then(async (result) => {
                if (result && result.user) {
                    const token = await result.user.getIdToken();
                    setSessionCookie(token);
                    window.location.href = "/";
                }
            }).catch((err) => {
                console.error("Redirect result error:", err);
                if (err.code !== "auth/credential-already-in-use") {
                    showError(err.message || "Sign-in failed after redirect. Please try again.");
                }
            });

            // If already signed in, redirect to app
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    const token = await user.getIdToken();
                    setSessionCookie(token);
                    window.location.href = "/";
                }
            });
        }

        // Auto-refresh token before expiry
        auth.onIdTokenChanged(async (user) => {
            if (user) {
                const token = await user.getIdToken();
                setSessionCookie(token);
            }
        });
    } catch (err) {
        console.error("Failed to load Firebase config:", err);
        showError("Unable to load authentication configuration. Please try again later.");
    }
})();

// Exported to window for onclick handlers
window.signInWithGoogle = function () {
    if (!auth) return showError("Authentication not ready. Please reload.");
    const provider = new firebase.auth.GoogleAuthProvider();
    handleSignIn(provider);
};

window.signInWithApple = function () {
    if (!auth) return showError("Authentication not ready. Please reload.");
    const provider = new firebase.auth.OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    handleSignIn(provider);
};

window.signInWithGitHub = function () {
    if (!auth) return showError("Authentication not ready. Please reload.");
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope("read:user");
    provider.addScope("user:email");
    handleSignIn(provider);
};
