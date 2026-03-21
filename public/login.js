// Login.js — Clerk Auth client-side logic
// Issue #158: Handles sign-in and sign-up via Clerk's embedded components.
// Both flows stay on our domain — no redirect to Clerk's hosted accounts page.

const errorEl = document.getElementById("login-error");
const subtitleEl = document.getElementById("login-subtitle");
const signInDiv = document.getElementById("clerk-sign-in");
const signUpDiv = document.getElementById("clerk-sign-up");

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add("visible");
}

/** Clerk appearance tokens — taverns-red dark theme */
const clerkAppearance = {
  variables: {
    colorPrimary: "#C13B3B",
    colorBackground: "#1a1625",
    colorText: "#e8e0f0",
    colorTextSecondary: "#a89cbd",
    colorInputBackground: "#252230",
    colorInputText: "#e8e0f0",
    borderRadius: "12px",
    fontFamily: "'Outfit', sans-serif",
  },
};

/**
 * Show the sign-in view and hide sign-up.
 */
function showSignIn() {
  signInDiv.style.display = "flex";
  signUpDiv.style.display = "none";
  subtitleEl.textContent = "Sign in to continue";
  document.title = "Sign In - AI Speech Evaluator";
  history.replaceState(null, "", "/login.html");
}

/**
 * Show the sign-up view and hide sign-in.
 */
function showSignUp() {
  signInDiv.style.display = "none";
  signUpDiv.style.display = "flex";
  subtitleEl.textContent = "Create your account";
  document.title = "Sign Up - AI Speech Evaluator";
  history.replaceState(null, "", "/login.html?mode=sign-up");
}

// ─── Fetch Clerk config from server and mount components ──────────────────────

(async function init() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error(`Config endpoint returned ${res.status}`);
    const config = await res.json();

    if (!config.publishableKey) {
      showError("Authentication is not configured. Contact the administrator.");
      return;
    }

    // Handle sign-out action from main app
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("action") === "signout") {
      document.cookie = "__session=;path=/;max-age=0";
      window.location.replace("/login.html");
      return;
    }

    // Decode Clerk Frontend API host from the publishable key
    const encodedHost = config.publishableKey.replace(/^pk_(test|live)_/, "");
    const clerkHost = atob(encodedHost).replace(/\$+$/, "");

    // Load Clerk JS from the Clerk Frontend API host
    const script = document.createElement("script");
    script.src = `https://${clerkHost}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
    script.dataset.clerkPublishableKey = config.publishableKey;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = async () => {
      try {
        const clerk = window.Clerk;
        if (!clerk) {
          showError("Authentication service failed to initialize.");
          return;
        }

        await clerk.load();

        // If already signed in, redirect to app
        if (clerk.user) {
          window.location.href = "/";
          return;
        }

        // Mount sign-in component
        signInDiv.innerHTML = "";
        clerk.mountSignIn(signInDiv, {
          afterSignInUrl: "/",
          signUpUrl: "/login.html?mode=sign-up",
          appearance: clerkAppearance,
        });

        // Mount sign-up component
        signUpDiv.innerHTML = "";
        clerk.mountSignUp(signUpDiv, {
          afterSignUpUrl: "/",
          signInUrl: "/login.html",
          appearance: clerkAppearance,
        });

        // Show the correct view based on URL params
        if (urlParams.get("mode") === "sign-up") {
          showSignUp();
        } else {
          showSignIn();
        }

        // Listen for Clerk navigation events to toggle views
        clerk.addListener((event) => {
          if (clerk.user) {
            window.location.href = "/";
          }
        });
      } catch (err) {
        console.error("Clerk initialization error:", err);
        showError("Authentication service failed to load. Please try again.");
      }
    };
    script.onerror = () => {
      showError("Failed to load authentication service. Please check your connection.");
    };
    document.head.appendChild(script);
  } catch (err) {
    console.error("Failed to load auth config:", err);
    showError("Unable to load authentication configuration. Please try again later.");
  }
})();
