function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const SESSION_HINT_STORAGE_KEY = "referly:lastSessionHint";

export function saveSessionHint(user, slug = "") {
  if (!user?.uid) return;
  try {
    const payload = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      slug: slug || "",
      savedAt: Date.now(),
    };
    globalThis.localStorage?.setItem(SESSION_HINT_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage issues (private mode / blocked storage).
  }
}

export function readSessionHint() {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_HINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.uid) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function clearSessionHint() {
  try {
    globalThis.localStorage?.removeItem(SESSION_HINT_STORAGE_KEY);
  } catch (_error) {
    // Ignore storage issues.
  }

  try {
    const sessionStore = globalThis.sessionStorage;
    if (!sessionStore) return;

    const keysToRemove = [];
    for (let index = 0; index < sessionStore.length; index += 1) {
      const key = sessionStore.key(index);
      if (key && key.startsWith("referly:")) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      sessionStore.removeItem(key);
    });
  } catch (_error) {
    // Ignore storage issues.
  }
}

export function accountControlsTemplate({
  includeProfileLink = false,
  includeCreateRequest = false,
  includeEditProfileAction = false,
  createRequestHref = "/create.html",
} = {}) {
  const safeCreateRequestHref = escapeHtml(createRequestHref);

  return `
    <aside id="accountDock" class="account-dock is-collapsed" aria-label="Main action area">
      <button id="accountDockToggleBtn" type="button" class="account-dock-toggle" aria-expanded="false" aria-controls="accountDockPanel" aria-label="Open main actions">
        <span aria-hidden="true">◎</span>
      </button>
      <div id="accountDockPanel" class="account-dock-panel" hidden>
        <p id="authStatus" class="status account-status">Not signed in.</p>
        <div class="auth-row account-auth-row">
          <button id="signInBtn" class="button button-primary">Continue with Google</button>
          <button id="signOutBtn" class="button button-secondary hidden">Sign out</button>
        </div>
        ${
          includeCreateRequest
            ? `<a id="accountCreateRequestLink" href="${safeCreateRequestHref}" class="button button-secondary account-action-link">Create request</a>`
            : ""
        }
        ${
          includeProfileLink
            ? `<div id="homeProfileUrlLine" class="account-profile-line">
                <span class="account-profile-label">Profile link:</span>
                <a id="homeProfileUrlAnchor" href="/profile.html" class="account-profile-anchor">My profile</a>
                <button id="accountCopyProfileLinkBtn" type="button" class="button button-secondary account-copy-button">Copy link</button>
              </div>`
            : ""
        }
        ${
          includeEditProfileAction
            ? `<button id="accountEditProfileBtn" type="button" class="button button-secondary hidden">Edit profile</button>`
            : ""
        }
      </div>
    </aside>
  `;
}

export function mountAccountControls(options = {}) {
  const existing = document.getElementById("accountDock");
  if (existing) return existing;
  document.body.insertAdjacentHTML("beforeend", accountControlsTemplate(options));
  return document.getElementById("accountDock");
}

export function initAccountControlsDock({ defaultCollapsed = true } = {}) {
  const dock = document.getElementById("accountDock");
  const toggleBtn = document.getElementById("accountDockToggleBtn");
  const panel = document.getElementById("accountDockPanel");
  const profileLinkAnchor = document.getElementById("homeProfileUrlAnchor");
  const copyProfileLinkBtn = document.getElementById("accountCopyProfileLinkBtn");
  if (!dock || !toggleBtn || !panel) return;

  /** @type {HTMLElement | null} */
  let previousFocusedElement = null;

  const getFocusableInPanel = () => {
    return Array.from(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("hidden"));
  };

  const setCollapsed = (collapsed) => {
    dock.classList.toggle("is-collapsed", collapsed);
    panel.hidden = collapsed;
    toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggleBtn.setAttribute("aria-label", collapsed ? "Open main actions" : "Close main actions");

    if (collapsed) {
      if (previousFocusedElement && previousFocusedElement.isConnected) {
        previousFocusedElement.focus();
      } else {
        toggleBtn.focus();
      }
      previousFocusedElement = null;
      return;
    }

    previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = getFocusableInPanel();
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  };

  const setCopyFeedback = (message) => {
    if (!copyProfileLinkBtn) return;
    copyProfileLinkBtn.textContent = message;
    globalThis.setTimeout(() => {
      copyProfileLinkBtn.textContent = "Copy link";
    }, 1200);
  };

  const copyText = async (text) => {
    if (!text) return false;
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_error) {
      // Continue to fallback.
    }

    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(area);
      return copied;
    } catch (_error) {
      return false;
    }
  };

  setCollapsed(defaultCollapsed);

  toggleBtn.addEventListener("click", () => {
    setCollapsed(!dock.classList.contains("is-collapsed"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setCollapsed(true);
      return;
    }

    if (event.key !== "Tab" || dock.classList.contains("is-collapsed")) {
      return;
    }

    const focusables = getFocusableInPanel();
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (dock.classList.contains("is-collapsed")) return;
    if (!dock.contains(event.target)) {
      setCollapsed(true);
    }
  });

  copyProfileLinkBtn?.addEventListener("click", async () => {
    const profileHref = profileLinkAnchor?.href || "";
    const copied = await copyText(profileHref);
    setCopyFeedback(copied ? "Copied!" : "Copy failed");
  });

  return { setCollapsed };
}

export function renderFooterLinks(container, links) {
  if (!container) return;
  container.innerHTML = links
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join("");
}
