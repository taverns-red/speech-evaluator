// Login.js — Clerk Auth client-side logic
// Issue #158: Handles sign-in via Clerk's embedded sign-in component.
// Replaces the previous Firebase Auth implementation.

const errorEl = document.getElementById("login-error");

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add("visible");
}

// ─── Fetch Clerk config from server and mount sign-in component ───────────────

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
      // Clear session cookie and reload login page
      document.cookie = "__session=;path=/;max-age=0";
      window.location.replace("/login.html");
      return;
    }

    // Load Clerk JS dynamically
    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
    script.crossOrigin = "anonymous";
    script.onload = async () => {
      try {
        const clerk = new window.Clerk(config.publishableKey);
        await clerk.load();

        // If already signed in, redirect to app
        if (clerk.user) {
          window.location.href = "/";
          return;
        }

        // Mount Clerk's sign-in component
        const signInDiv = document.getElementById("clerk-sign-in");
        signInDiv.innerHTML = ""; // Clear loading message
        clerk.mountSignIn(signInDiv, {
          afterSignInUrl: "/",
          appearance: {
            variables: {
              colorPrimary: "#C13B3B",
              colorBackground: "#1a1625",
              colorText: "#e8e0f0",
              colorInputBackground: "#252230",
              colorInputText: "#e8e0f0",
              borderRadius: "12px",
              fontFamily: "'Outfit', sans-serif",
            },
          },
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
