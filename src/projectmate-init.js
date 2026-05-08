const PROJECTMATE_WEB3FORMS_ACCESS_KEY = "9cca9887-00a4-44b9-9909-e445e2773ff5";

function initProjectMate() {
  if (typeof window === "undefined") return;
  if (!window.ProjectMate || typeof window.ProjectMate.init !== "function") return;
  if (window.__projectMateInitialized) return;

  const config = {
    projectId: "referly",
    appUrl: "https://projectmate.uft1.com/overlay/",
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
    links: {
      docs: window.location.origin + "/about.html",
      privacy: window.location.origin + "/privacy.html",
    },
    changelog: [
      {
        version: "1.0.0",
        date: "2026-05-09",
        bullets: ["Integrated ProjectMate help and updates overlay."],
      },
    ],
    launcher: {
      position: "bottom-right",
      offsetX: 16,
      offsetY: 16,
      label: "Help",
    },
    autoOpen: {
      hash: "help",
      query: { name: "help", value: "1" },
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
}

initProjectMate();
