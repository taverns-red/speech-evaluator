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
        const result = await auth.signInWithPopup(provider);
        const token = await result.user.getIdToken();
        setSessionCookie(token);
        window.location.href = "/";
    } catch (err) {
        if (err.code === "auth/popup-closed-by-user") {
            enableButtons();
            loadingEl.classList.remove("visible");
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
