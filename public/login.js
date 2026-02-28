// Login.js — Firebase Auth client-side logic
// Issue #37: Handles sign-in with Google, Apple, and GitHub providers.
// Sets __session cookie with Firebase ID token for server-side verification.

/* global firebase */

// Firebase config — uses the existing toast-stats-prod project
const firebaseConfig = {
    apiKey: "AIzaSyCIgfpT_v-WpW1jJCJBFwOBHN5qlUC9C4A",
    authDomain: "toast-stats-prod-6d64a.firebaseapp.com",
    projectId: "toast-stats-prod-6d64a",
    appId: "1:736334703361:web:speech-evaluator",
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

// If already signed in, redirect to app
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const token = await user.getIdToken();
        setSessionCookie(token);
        window.location.href = "/";
    }
});

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
