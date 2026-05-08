const PROJECTMATE_WEB3FORMS_ACCESS_KEY = "9cca9887-00a4-44b9-9909-e445e2773ff5";

function initProjectMate() {
  if (typeof window === "undefined") return;
  if (!window.ProjectMate || typeof window.ProjectMate.init !== "function") return;
  if (window.__projectMateInitialized) return;

  const config = {
    projectId: "referly",
    appUrl: "https://projectmate.uft1.com/overlay/",
    multiHost: {
      enabled: false,
      activeHostId: "referly-prod",
      totalHosts: 1,
      canSwitchHosts: false,
      benchmarkLabel: "Single-host deployment",
    },
    about: {
      title: "Referly",
      description: "Reference checks with mutual confirmations from real former colleagues.",
    },
    features: {
      chat: false,
      feedback: true,
      updates: true,
      issues: false,
      about: true,
    },
    theme: "auto",
    accentColor: "#4f46e5",
    changelog: [
      {
        version: "Host v1.3.0",
        date: "2026-05-09",
        bullets: ["Current Referly production host metadata and ProjectMate integration active."],
      },
      {
        version: "1.3.0",
        date: "2026-05-09",
        bullets: [
          "Added ProjectMate embedded Help and Updates overlay across all pages.",
          "Enabled in-app feedback delivery via Web3Forms.",
        ],
      },
      {
        version: "1.2.0",
        date: "2026-05-08",
        bullets: [
          "Improved homepage onboarding flow and overall copy clarity.",
          "Added inline sign-in action on confirmation for a faster approval path.",
          "Corrected repository and privacy contact links.",
        ],
      },
      {
        version: "1.1.0",
        date: "2026-05-07",
        bullets: [
          "Added floating account action dock and dedicated request page.",
          "Hardened Firestore rules and reduced duplicate/invalid confirmation edge cases.",
          "Improved profile editing reliability and protected user-edited profile fields.",
        ],
      },
      {
        version: "1.0.0",
        date: "2026-05-05",
        bullets: [
          "Launched Referly with Google sign-in and Firebase-backed reference flow.",
          "Shipped request creation, confirmation, and public profile pages.",
        ],
      },
    ],
    quotes: [
      "Trust grows when real people confirm real work.",
      "Ship, learn, improve.",
      "Clarity beats cleverness.",
    ],
    launcher: {
      hidden: true,
      position: "bottom-right",
      offsetX: 16,
      offsetY: 16,
      label: "Support",
    },
    autoOpen: {
      hash: "support",
      query: { name: "support", value: "1" },
      path: "/support",
      pathMatch: "prefix",
    },
  };

  if (PROJECTMATE_WEB3FORMS_ACCESS_KEY) {
    config.web3forms = {
      accessKey: PROJECTMATE_WEB3FORMS_ACCESS_KEY,
      subject: "Feedback - Referly",
      fromName: "Referly ProjectMate",
    };
  }

  window.ProjectMate.init(config);
  window.__projectMateInitialized = true;
  window.dispatchEvent(new Event("projectmate:ready"));
}

initProjectMate();
