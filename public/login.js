// Login.js — Firebase Auth client-side logic
// Issue #37: Handles sign-in with Google, Apple, and GitHub providers.
// Sets __session cookie with Firebase ID token for server-side verification.

/* global firebase */

// Firebase config — uses the existing toast-stats-prod project
const firebaseConfig = {
    apiKey: "REDACTED_FIREBASE_API_KEY",
    authDomain: "toast-stats-prod-6d64a.firebaseapp.com",
    projectId: "toast-stats-prod-6d64a",
    appId: "1:736334703361:web:b7174dfd26dab25cf2c900",
    messagingSenderId: "736334703361",
    measurementId: "G-LLLNH352T3",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM elements
const errorEl = document.getElementById("login-error");
const loadingEl = document.getElementById("login-loading");
const btnGoogle = document.getElementById("btn-google");
const btnApple = document.getElementById("btn-apple");
const btnGitHub = document.getElementById("btn-github");

// Handle sign-out action from main app
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("action") === "signout") {
    auth.signOut().then(() => {
        document.cookie = "__session=;path=/;max-age=0";
        // Remove the query param to prevent re-triggering on refresh
        window.history.replaceState({}, "", "/login.html");
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

// Exported to window for onclick handlers
window.signInWithGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    handleSignIn(provider);
};

window.signInWithApple = function () {
    const provider = new firebase.auth.OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    handleSignIn(provider);
};

window.signInWithGitHub = function () {
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope("read:user");
    provider.addScope("user:email");
    handleSignIn(provider);
};
